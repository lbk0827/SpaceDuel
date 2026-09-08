// Canvas 2D 렌더. 월드(원점 중심, y 위) → 화면(y 아래) 변환을 여기서 한 번만 한다.
import { SLOT_COLORS, spriteFor } from './sprites.js';
import { ITEM_DEFS, ITEM_RADIUS } from './items.js';

const SVG_PX_PER_M = 100;
const boltColor = (i) => SLOT_COLORS[i % SLOT_COLORS.length].bolt;

export function createRenderer(canvas, WORLD) {
  const ctx = canvas.getContext('2d');
  // 별은 정규 좌표(-0.5~0.5)로 두고 방 크기에 맞춰 늘린다 — 방이 커져도 밀도가 유지된다
  const stars = Array.from({ length: 120 }, () => ({ u: Math.random() - 0.5, v: Math.random() - 0.5, r: Math.random() * 1.5 + 0.4, a: Math.random() * 0.6 + 0.3 }));
  let arena = { width: 16, height: 9, halfW: 8, halfH: 4.5 };

  let scale = 60, cx = 0, cy = 0;
  const trails = [];   // { x0,y0,x1,y1, owner, age }
  let elapsed = 0;
  const flashes = [];  // { x, y, age, kind:'muzzle'|'hit', owner }

  function fit() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = w / arena.width;   // 방이 넓어지면 스케일이 줄어 캐릭터가 자동으로 작게 보인다
    cx = w / 2; cy = h / 2;
  }
  fit();
  new ResizeObserver(fit).observe(canvas);

  const sx = (x) => cx + x * scale;
  const sy = (y) => cy - y * scale;

  function drawBody(slot, tuning, shape) {
    const round = !(shape && shape.halfHeight > 0);
    const img = spriteFor(slot.index, !round);
    const { pose, facing } = slot.snap;
    ctx.save();
    ctx.translate(sx(pose.x), sy(pose.y));
    ctx.rotate(-pose.angle);          // 월드 CCW → 화면(y 아래) 에서는 반대
    ctx.scale(facing, 1);
    const s = scale / SVG_PX_PER_M;
    if (img.complete && img.naturalWidth) {
      if (round) ctx.drawImage(img, -60 * s, -60 * s, 120 * s, 120 * s);
      else ctx.drawImage(img, -60 * s, -70 * s, 120 * s, 140 * s);
    }
    else { ctx.fillStyle = boltColor(slot.index); ctx.fillRect(-0.25 * scale, -0.6 * scale, 0.5 * scale, 1.2 * scale); }
    // 총구 방향 가이드 (로컬 +x, 어깨 높이). SVG 좌표는 위가 음수 → -gunOffsetY
    if (tuning.aimGuide) {
      ctx.strokeStyle = boltColor(slot.index) + '88';
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
  function drawGauge(slot, gauge, shape) {
    if (!gauge) return;
    const r = (shape?.halfHeight ?? 0) + (shape?.radius ?? 0.45);
    const x = sx(slot.snap.pose.x), y = sy(slot.snap.pose.y) - (r + 0.32) * scale;
    const color = boltColor(slot.index);
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

  /** 내 캐릭터 표식 — 몸 회전과 무관하게 화면 정방향. 색이 슬롯마다 달라 표식이 있어야 즉시 찾는다 */
  function drawYouMarker(slot, shape) {
    const r = (shape && shape.halfHeight ? shape.halfHeight : 0) + (shape && shape.radius ? shape.radius : 0.45);
    const x = sx(slot.snap.pose.x), y = sy(slot.snap.pose.y);
    const color = boltColor(slot.index);
    ctx.save();
    // 머리 위 삼각 표식만 (몸 주변 링은 유저 요청으로 제거)
    const ty = y - (r + 0.72) * scale;
    const w = 0.16 * scale, h = 0.2 * scale;
    ctx.beginPath();
    ctx.moveTo(x - w, ty);
    ctx.lineTo(x + w, ty);
    ctx.lineTo(x, ty + h);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** 아이템 상자: 종류 색 + 글자. 살짝 떠 있는 느낌으로 흔든다 */
  function drawItem(it, t) {
    const def = ITEM_DEFS[it.kind] ?? { color: '#fff', short: '?' };
    const bob = Math.sin(t * 2.2 + it.id) * 0.06;
    const x = sx(it.x), y = sy(it.y + bob);
    const r = ITEM_RADIUS * scale;
    ctx.save();
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = def.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x - r, y - r, r * 2, r * 2, r * 0.35) : ctx.rect(x - r, y - r, r * 2, r * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0b1030';
    ctx.font = `700 ${Math.max(8, r * 0.62)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.short[0], x, y + 1);
    ctx.restore();
  }

  /** 배달 우주선 */
  function drawShip(sh) {
    const x = sx(sh.x), y = sy(sh.y);
    const w = 1.6 * scale, h = 0.5 * scale;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sh.dir, 1);
    ctx.fillStyle = '#8ea2c8';
    ctx.strokeStyle = '#243055';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 4, -h / 2);
    ctx.lineTo(w / 2, -h / 4);
    ctx.lineTo(w / 2, h / 4);
    ctx.lineTo(-w / 4, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3b9dff';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(w * 0.05 + i * h * 0.42, 0, h * 0.13, 0, Math.PI * 2);
      ctx.fill();
    }
    // 엔진 불꽃
    ctx.fillStyle = '#ffd43b';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.18);
    ctx.lineTo(-w / 2 - h * (0.5 + Math.random() * 0.4), 0);
    ctx.lineTo(-w / 2, h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** 배리어: 남은 횟수만큼 몸 주변 호 */
  function drawBarrier(slot, shape) {
    const n = slot.mods && slot.mods.barrier ? slot.mods.barrier : 0;
    if (!n) return;
    const r = ((shape && shape.halfHeight ? shape.halfHeight : 0) + (shape && shape.radius ? shape.radius : 0.45) + 0.22) * scale;
    const x = sx(slot.snap.pose.x), y = sy(slot.snap.pose.y);
    ctx.save();
    ctx.strokeStyle = ITEM_DEFS.barrier.color;
    ctx.shadowColor = ITEM_DEFS.barrier.color;
    ctx.shadowBlur = 10;
    ctx.lineWidth = 3;
    for (let i = 0; i < n; i++) {
      const span = (Math.PI * 2) / n;
      const gap = 0.22;
      ctx.beginPath();
      ctx.arc(x, y, r + i * 4, i * span + gap / 2, (i + 1) * span - gap / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  return {
    canvas,
    setArena(next) { arena = next; fit(); },
    addTrail(x0, y0, x1, y1, ownerIndex) { trails.push({ x0, y0, x1, y1, ownerIndex, age: 0 }); },
    addFlash(x, y, kind, ownerIndex) { flashes.push({ x, y, kind, ownerIndex, age: 0 }); },
    clearEffects() { trails.length = 0; flashes.length = 0; },

    /** @param view { slots:[{id,index,alive,snap,gauge}], bolts:[], timeScale, tuning, shape } */
    render(view, dtReal) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      // 배경: 우주
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a2550'); g.addColorStop(1, '#0b1030');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (const st of stars) { ctx.fillStyle = `rgba(255,255,255,${st.a})`; ctx.beginPath(); ctx.arc(sx(st.u * arena.width), sy(st.v * arena.height), st.r, 0, Math.PI * 2); ctx.fill(); }
      // 방 내부 벽 라인
      const t = WORLD.wallThickness, hw = arena.halfW, hh = arena.halfH;
      ctx.fillStyle = '#2c3a66';
      ctx.fillRect(0, 0, w, sy(hh)); ctx.fillRect(0, sy(-hh), w, h - sy(-hh));
      ctx.fillRect(0, 0, sx(-hw), h); ctx.fillRect(sx(hw), 0, w - sx(hw), h);
      ctx.strokeStyle = '#6f83c9'; ctx.lineWidth = 3;
      ctx.strokeRect(sx(-hw), sy(hh), arena.width * scale, arena.height * scale);
      void t;

      // 잔상
      for (let i = trails.length - 1; i >= 0; i--) {
        const tr = trails[i]; tr.age += dtReal;
        const k = 1 - tr.age / WORLD.boltTrail;
        if (k <= 0) { trails.splice(i, 1); continue; }
        ctx.strokeStyle = boltColor(tr.ownerIndex); ctx.globalAlpha = k * 0.5; ctx.lineWidth = 3 * k;
        ctx.beginPath(); ctx.moveTo(sx(tr.x0), sy(tr.y0)); ctx.lineTo(sx(tr.x1), sy(tr.y1)); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 몸 (살아 있고 자세를 얻은 슬롯만)
      // 아이템·배달선 (몸보다 아래 레이어)
      elapsed += dtReal;
      if (view.items) for (const it of view.items) drawItem(it, elapsed);
      if (view.ship) drawShip(view.ship);

      const shown = view.slots.filter((s) => s.alive && s.snap);
      for (const s of shown) drawBarrier(s, view.shape);
      for (const s of shown) if (s.isLocal) drawYouMarker(s, view.shape);
      for (const s of shown) drawBody(s, view.tuning, view.shape);
      for (const s of shown) drawGauge(s, s.gauge, view.shape);

      // 탄: 선두점에서 뒤로 boltLength 광선 + 글로우
      for (const b of view.bolts) {
        const L = Math.hypot(b.vx, b.vy) || 1;
        const tx = b.x - (b.vx / L) * WORLD.boltLength, ty = b.y - (b.vy / L) * WORLD.boltLength;
        ctx.save();
        ctx.shadowColor = boltColor(b.ownerIndex); ctx.shadowBlur = 16;
        ctx.strokeStyle = boltColor(b.ownerIndex); ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sx(tx), sy(ty)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(sx(tx), sy(ty)); ctx.lineTo(sx(b.x), sy(b.y)); ctx.stroke();
        ctx.restore();
      }

      // 플래시
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]; f.age += dtReal;
        const dur = f.kind === 'hit' ? 0.5 : f.kind === 'block' ? 0.35 : f.kind === 'item' ? 0.4 : 0.1;
        const k = 1 - f.age / dur;
        if (k <= 0) { flashes.splice(i, 1); continue; }
        ctx.globalAlpha = k;
        ctx.strokeStyle = ctx.fillStyle = boltColor(f.ownerIndex);
        if (f.kind === 'hit') { ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), (1 - k) * 1.2 * scale + 6, 0, Math.PI * 2); ctx.stroke(); }
        else if (f.kind === 'block') {
          ctx.strokeStyle = ITEM_DEFS.barrier.color; ctx.lineWidth = 5;
          ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), (1 - k) * 0.7 * scale + 8, 0, Math.PI * 2); ctx.stroke();
        } else if (f.kind === 'item') {
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), (1 - k) * 1.0 * scale + 4, 0, Math.PI * 2); ctx.stroke();
        }
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
