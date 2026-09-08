// Canvas 2D 렌더. 월드(원점 중심, y 위) → 화면(y 아래) 변환을 여기서 한 번만 한다.
import { astronautSvg, loadSprite, PLAYER_COLORS, AI_COLORS } from './sprites.js';

const BOLT_COLORS = { player: '#3b9dff', ai: '#ff4b4b' };
const SVG_PX_PER_M = 100;

export function createRenderer(canvas, WORLD) {
  const ctx = canvas.getContext('2d');
  const sprites = {
    capsule: { player: loadSprite(astronautSvg(PLAYER_COLORS)), ai: loadSprite(astronautSvg(AI_COLORS)) },
    ball: { player: loadSprite(astronautSvg({ ...PLAYER_COLORS, legs: false })), ai: loadSprite(astronautSvg({ ...AI_COLORS, legs: false })) },
  };
  const stars = Array.from({ length: 90 }, () => ({ x: Math.random() * 16 - 8, y: Math.random() * 9 - 4.5, r: Math.random() * 1.5 + 0.4, a: Math.random() * 0.6 + 0.3 }));

  let scale = 60, cx = 0, cy = 0;
  const trails = [];   // { x0,y0,x1,y1, owner, age }
  const flashes = [];  // { x, y, age, kind:'muzzle'|'hit', owner }

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = w / WORLD.width;
    cx = w / 2; cy = h / 2;
  }
  fit();
  new ResizeObserver(fit).observe(canvas);

  const sx = (x) => cx + x * scale;
  const sy = (y) => cy - y * scale;

  function drawBody(id, snap, tuning, shape) {
    const round = !(shape && shape.halfHeight > 0);
    const img = (round ? sprites.ball : sprites.capsule)[id];
    const { pose, facing } = snap;
    ctx.save();
    ctx.translate(sx(pose.x), sy(pose.y));
    ctx.rotate(-pose.angle);          // 월드 CCW → 화면(y 아래) 에서는 반대
    ctx.scale(facing, 1);
    const s = scale / SVG_PX_PER_M;
    if (img.complete && img.naturalWidth) {
      if (round) ctx.drawImage(img, -60 * s, -60 * s, 120 * s, 120 * s);
      else ctx.drawImage(img, -60 * s, -70 * s, 120 * s, 140 * s);
    }
    else { ctx.fillStyle = id === 'player' ? '#9cf' : '#f99'; ctx.fillRect(-0.25 * scale, -0.6 * scale, 0.5 * scale, 1.2 * scale); }
    // 총구 방향 가이드 (로컬 +x, 어깨 높이). SVG 좌표는 위가 음수 → -gunOffsetY
    if (tuning.aimGuide) {
      ctx.strokeStyle = (id === 'player' ? BOLT_COLORS.player : BOLT_COLORS.ai) + '88';
      ctx.setLineDash([4, 6]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tuning.gunOffsetX * scale, -tuning.gunOffsetY * scale);
      ctx.lineTo((tuning.gunOffsetX + 1.6) * scale, -tuning.gunOffsetY * scale);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  /** 머리 위 발사 게이지 — 몸 회전과 무관하게 화면 정방향. cooldown = 링, energy = 칸 */
  function drawGauge(id, snap, gauge, shape) {
    if (!gauge) return;
    const r = (shape?.halfHeight ?? 0) + (shape?.radius ?? 0.45);
    const x = sx(snap.pose.x), y = sy(snap.pose.y) - (r + 0.32) * scale;
    const color = BOLT_COLORS[id];
    ctx.save();
    ctx.lineCap = 'round';
    if (gauge.mode === 'cooldown') {
      const R = 0.16 * scale, k = Math.max(0, Math.min(1, gauge.ready));
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#ffffff33'; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.stroke();
      if (k >= 1) {
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, R * 0.75, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k); ctx.stroke();
      }
    } else {
      const n = gauge.max, w = 0.12 * scale, h = 0.22 * scale, gap = 0.04 * scale;
      const total = n * w + (n - 1) * gap;
      const full = Math.floor(gauge.energy), frac = gauge.energy - full;
      for (let i = 0; i < n; i++) {
        const px = x - total / 2 + i * (w + gap);
        const fill = i < full ? 1 : i === full ? frac : 0;
        ctx.fillStyle = '#ffffff33'; ctx.fillRect(px, y - h / 2, w, h);
        if (fill > 0) { ctx.fillStyle = color; ctx.fillRect(px, y + h / 2 - h * fill, w, h * fill); }
      }
    }
    ctx.restore();
  }

  return {
    canvas,
    addTrail(x0, y0, x1, y1, owner) { trails.push({ x0, y0, x1, y1, owner, age: 0 }); },
    addFlash(x, y, kind, owner) { flashes.push({ x, y, kind, owner, age: 0 }); },
    clearEffects() { trails.length = 0; flashes.length = 0; },

    /** @param view { bodies:{player,ai}, bolts:[], timeScale, tuning } */
    render(view, dtReal) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      // 배경: 우주
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a2550'); g.addColorStop(1, '#0b1030');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const st of stars) { ctx.fillStyle = `rgba(255,255,255,${st.a})`; ctx.beginPath(); ctx.arc(sx(st.x), sy(st.y), st.r, 0, Math.PI * 2); ctx.fill(); }
      // 방 내부 벽 라인
      const t = WORLD.wallThickness, hw = WORLD.width / 2, hh = WORLD.height / 2;
      ctx.fillStyle = '#2c3a66';
      ctx.fillRect(0, 0, w, sy(hh)); ctx.fillRect(0, sy(-hh), w, h - sy(-hh));
      ctx.fillRect(0, 0, sx(-hw), h); ctx.fillRect(sx(hw), 0, w - sx(hw), h);
      ctx.strokeStyle = '#6f83c9'; ctx.lineWidth = 3;
      ctx.strokeRect(sx(-hw), sy(hh), WORLD.width * scale, WORLD.height * scale);
      void t;

      // 잔상
      for (let i = trails.length - 1; i >= 0; i--) {
        const tr = trails[i]; tr.age += dtReal;
        const k = 1 - tr.age / WORLD.boltTrail;
        if (k <= 0) { trails.splice(i, 1); continue; }
        ctx.strokeStyle = BOLT_COLORS[tr.owner]; ctx.globalAlpha = k * 0.5; ctx.lineWidth = 3 * k;
        ctx.beginPath(); ctx.moveTo(sx(tr.x0), sy(tr.y0)); ctx.lineTo(sx(tr.x1), sy(tr.y1)); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 몸
      for (const id of ['player', 'ai']) if (view.bodies[id]) drawBody(id, view.bodies[id], view.tuning, view.shape);
      for (const id of ['player', 'ai']) if (view.bodies[id]) drawGauge(id, view.bodies[id], view.gauges?.[id], view.shape);

      // 탄: 선두점에서 뒤로 boltLength 광선 + 글로우
      for (const b of view.bolts) {
        const L = Math.hypot(b.vx, b.vy) || 1;
        const tx = b.x - (b.vx / L) * WORLD.boltLength, ty = b.y - (b.vy / L) * WORLD.boltLength;
        ctx.save();
        ctx.shadowColor = BOLT_COLORS[b.owner]; ctx.shadowBlur = 16;
        ctx.strokeStyle = BOLT_COLORS[b.owner]; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx(tx), sy(ty)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx(tx), sy(ty)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        ctx.restore();
      }

      // 플래시
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]; f.age += dtReal;
        const dur = f.kind === 'hit' ? 0.5 : 0.1;
        const k = 1 - f.age / dur;
        if (k <= 0) { flashes.splice(i, 1); continue; }
        ctx.globalAlpha = k;
        ctx.strokeStyle = ctx.fillStyle = BOLT_COLORS[f.owner];
        if (f.kind === 'hit') { ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), (1 - k) * 1.2 * scale + 6, 0, Math.PI * 2); ctx.stroke(); }
        else { ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), 0.18 * scale * (0.5 + k), 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.globalAlpha = 1;

      // 슬로모 비네트
      if (view.timeScale < 1) {
        const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
      }
    },
  };
}
