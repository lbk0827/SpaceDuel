// 엔트리. 라운드·시간·입력·AI 를 조율한다. 규칙은 laser/firegate/ai 에, 물리는 physics 에.
import RAPIER from 'rapier';
import { WORLD, tuning, bodyShapeOf } from './tuning.js';
import { createPhysics } from './physics.js';
import { createFireGate } from './firegate.js';
import { stepBolt, willHit } from './laser.js';
import { decide, muzzleOf } from './ai.js';
import { createRenderer } from './renderer.js';
import { createHud } from './hud.js';
import { createPanel } from './panel.js';

await RAPIER.init();

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, WORLD);
const physics = createPhysics(RAPIER, tuning, WORLD);
const hud = createHud(document.getElementById('app'));
createPanel(document.getElementById('panel'));

const ARENA = { halfW: WORLD.width / 2, halfH: WORLD.height / 2 };
let CAP = bodyShapeOf(); // 라운드 시작 시 갱신
const gates = { player: createFireGate(tuning), ai: createFireGate(tuning) };
const aiMem = { onTargetSince: null, lastGoodAt: 0 };

// ---- 상태 ----
let round = 0;
const score = { player: 0, ai: 0 };
let state = 'playing';    // playing | roundEnd | matchEnd
let gameTime = 0;         // 게임 시간(슬로모 반영). 라운드마다 0 부터
let timeScale = 1;
let bolts = [];
let nextBoltId = 1;
let acc = 0;

function startRound() {
  const spawns = WORLD.spawn(round);
  CAP = bodyShapeOf();
  physics.reset(spawns, CAP);
  for (const g of Object.values(gates)) g.reset();
  aiMem.onTargetSince = null; aiMem.lastGoodAt = 0;
  bolts = []; renderer.clearEffects();
  gameTime = 0; timeScale = 1; acc = 0;
  state = 'playing';
  hud.hideBanner();
  hud.setScore(score.player, score.ai);
}

function fire(id) {
  if (state !== 'playing' || gameTime < tuning.spawnLock) return false;
  const snap = physics.get(id);
  if (!snap) return false;
  if (!gates[id].tryFire()) return false;
  const m = muzzleOf(snap, tuning);
  bolts.push({ id: nextBoltId++, owner: id, x: m.pos.x + m.dir.x * 0.15, y: m.pos.y + m.dir.y * 0.15, vx: m.dir.x * tuning.laserSpeed, vy: m.dir.y * tuning.laserSpeed });
  physics.applyRecoil(id, m.pos, m.dir, tuning.recoilImpulse);
  renderer.addFlash(m.pos.x + m.dir.x * 0.2, m.pos.y + m.dir.y * 0.2, 'muzzle', id);
  return true;
}

canvas.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.button === undefined) fire('player'); });

function targetsOf() {
  const out = [];
  for (const id of ['player', 'ai']) { const s = physics.get(id); if (s) out.push({ id, pose: s.pose, cap: CAP, snap: s }); }
  return out;
}

function fixedStep(dt) {
  gameTime += dt;
  for (const g of Object.values(gates)) g.update(dt);
  physics.step();

  // AI
  const ai = physics.get('ai'), pl = physics.get('player');
  if (ai && pl && gameTime >= tuning.spawnLock) {
    const threats = tuning.aiDodgeLookahead > 0 ? bolts.filter((b) => b.owner === 'player') : [];
    const d = decide(ai, pl, { ...tuning, now: gameTime, canFire: gates.ai.canFire(), cap: CAP, bolts: threats }, aiMem);
    if (d.fire) fire('ai');
  }

  // 탄
  const targets = targetsOf();
  const hits = [];
  const alive = [];
  for (const b of bolts) {
    const r = stepBolt(b, dt, targets, ARENA);
    renderer.addTrail(b.x, b.y, r.bolt.x, r.bolt.y, b.owner);
    if (r.hit) hits.push({ owner: b.owner, ...r.hit });
    else if (!r.dead) alive.push(r.bolt);
  }
  bolts = alive;
  if (hits.length) resolveHits(hits);
}

function resolveHits(hits) {
  const victims = new Set(hits.map((h) => h.targetId));
  for (const h of hits) renderer.addFlash(h.point.x, h.point.y, 'hit', h.owner);
  timeScale = 1;
  state = 'roundEnd';
  bolts = [];
  if (victims.size >= 2) {
    hud.showBanner({ title: '동시 명중!', text: '무효 — 다시' });
    setTimeout(() => { round++; startRound(); }, 1500);
    return;
  }
  const loser = [...victims][0];
  const winner = loser === 'player' ? 'ai' : 'player';
  score[winner]++;
  hud.setScore(score.player, score.ai);
  if (score[winner] >= tuning.roundsToWin) {
    state = 'matchEnd';
    hud.showBanner({
      title: winner === 'player' ? '승리!' : '패배…',
      text: `${score.player} : ${score.ai}`,
      buttons: [{ label: '다시', onClick: () => { score.player = 0; score.ai = 0; round = 0; startRound(); } }],
    });
    return;
  }
  hud.showBanner({ title: winner === 'player' ? '명중!' : '피격!', text: `${score.player} : ${score.ai}` });
  setTimeout(() => { round++; startRound(); }, 1500);
}

function computeSlowmo() {
  if (state !== 'playing' || tuning.slowmoLookahead <= 0) return 1;
  const targets = targetsOf();
  for (const b of bolts) for (const t of targets) if (willHit(b, t, tuning.slowmoLookahead)) return tuning.slowmoScale;
  return 1;
}

// ---- 루프 ----
let lastT = performance.now();
function frame(now) {
  const dtReal = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;

  if (state === 'playing') {
    timeScale = computeSlowmo();
    acc = Math.min(acc + dtReal * timeScale, WORLD.physicsStep * 8);
    while (acc >= WORLD.physicsStep && state === 'playing') { acc -= WORLD.physicsStep; fixedStep(WORLD.physicsStep); }
  }

  renderer.render({
    bodies: { player: physics.get('player'), ai: physics.get('ai') },
    bolts, timeScale, tuning, shape: CAP,
    gauges: { player: gates.player.state(), ai: gates.ai.state() },
  }, dtReal);
  hud.setGauge(gates.player.state());
  requestAnimationFrame(frame);
}

startRound();
requestAnimationFrame(frame);

// 디버그 훅
window.__rd = {
  state: () => state, score: () => ({ ...score }), gameTime: () => gameTime,
  body: (id) => physics.get(id), bolts: () => bolts, fire, startRound,
};
