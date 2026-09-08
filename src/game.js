// 엔트리. 슬롯·라운드·시간·입력·봇을 조율한다. 규칙은 laser/firegate/ai/arena 에, 물리는 physics 에.
import RAPIER from 'rapier';
import { WORLD, tuning, bodyShapeOf } from './tuning.js';
import { arenaFor, spawnsFor } from './arena.js';
import { createPhysics } from './physics.js';
import { createFireGate } from './firegate.js';
import { stepBolt, willHit } from './laser.js';
import { decide, muzzleOf } from './ai.js';
import { createRenderer } from './renderer.js';
import { createHud } from './hud.js';
import { createPanel } from './panel.js';
import { SLOT_COLORS } from './sprites.js';
import { createNet, MAX_PLAYERS } from './net.js';
import { showStart, showSoloSetup, showWaiting, ensureRoom, roomFromUrl, transportFromUrl, hostFromUrl, markSelfAsHost } from './lobby.js';

await RAPIER.init();

const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, WORLD);
const physics = createPhysics(RAPIER, tuning, WORLD);
const hud = createHud(document.getElementById('app'));
createPanel(document.getElementById('panel'));

// ---- 슬롯 ----
/** slot = { id, index, kind:'local'|'remote'|'bot', label, score, alive, gate, aiMem } */
let slots = [];
let localSlot = null;
let arena = arenaFor(1, tuning);
let shape = bodyShapeOf();

/** kinds 배열대로 슬롯을 만든다. 예: local + bot 3개 */
function buildSlots(kinds) {
  slots = kinds.slice(0, SLOT_COLORS.length).map((kind, index) => ({
    id: 'p' + index,
    index,
    kind,
    label: kind === 'local' ? 'YOU' : kind === 'bot' ? 'BOT' + index : 'P' + (index + 1),
    score: 0,
    alive: true,
    gate: createFireGate(tuning),
    aiMem: { onTargetSince: null, lastGoodAt: 0 },
  }));
  localSlot = slots.find((s) => s.kind === 'local') ?? null;
}

const slotById = (id) => slots.find((s) => s.id === id);
const aliveSlots = () => slots.filter((s) => s.alive);

// ---- 네트워크 ----
let net = null;                 // null = 혼자 하기
let mode = 'lobby';             // lobby | waiting | solo | online
/** 슬롯 순서대로의 주인: peerId 또는 'bot'. 방장이 정해서 배포한다(모두 같은 배치를 봐야 한다) */
let slotOwners = [];
let onlineFillBots = false;
let poseTimer = 0;
const POSE_INTERVAL = 1 / 30;
/** 라운드를 최종 판정하는 쪽 (혼자 하기는 나, 온라인은 방장) */
const isAuthority = () => !net || net.isHost();
/** 내가 발사를 책임지는 슬롯: 내 몸 + (방장이면) 봇들 */
const ownsSlot = (id) => {
  const s = slotById(id);
  if (!s) return false;
  if (s.kind === 'local') return true;
  return s.kind === 'bot' && isAuthority();
};

// ---- 상태 ----
let round = 0;
let state = 'idle';        // idle | playing | roundEnd | matchEnd
let gameTime = 0;          // 게임 시간(슬로모 반영). 라운드마다 0 부터
let timeScale = 1;
let bolts = [];
let nextBoltId = 1;
let acc = 0;

/** 방 크기에 비례해 보정된 유효 값 */
const effLaserSpeed = () => tuning.laserSpeed * arena.speedScale;
const effRecoil = () => tuning.recoilImpulse * arena.speedScale;

function startMatch(kinds) {
  buildSlots(kinds);
  round = 0;
  startRound();
}

function startRound() {
  arena = arenaFor(slots.length, tuning);
  shape = bodyShapeOf();
  renderer.setArena(arena);
  const ids = slots.map((s) => s.id);
  physics.reset(spawnsFor(ids, arena), shape, arena);
  for (const s of slots) {
    s.alive = true;
    s.gate.reset();
    s.aiMem.onTargetSince = null;
    s.aiMem.lastGoodAt = 0;
  }
  bolts = [];
  renderer.clearEffects();
  gameTime = 0; timeScale = 1; acc = 0;
  state = 'playing';
  hud.hideBanner();
  syncScores();
}

function syncScores() {
  hud.setScores(slots.map((s) => ({
    index: s.index, score: s.score, alive: s.alive,
    label: s.kind === 'local' ? 'YOU(' + SLOT_COLORS[s.index % SLOT_COLORS.length].name + ')' : s.label,
  })));
}

/** 발사. 원격·봇도 같은 경로를 쓴다. override = { pos, dir } 면 그 총구를 그대로 사용 */
function fire(slotId, override = null) {
  if (state !== 'playing' || gameTime < tuning.spawnLock) return null;
  const slot = slotById(slotId);
  if (!slot || !slot.alive) return null;
  const snap = physics.get(slotId);
  if (!snap) return null;
  if (!slot.gate.tryFire()) return null;

  const m = override ?? muzzleOf(snap, tuning);
  const speed = effLaserSpeed();
  bolts.push({
    id: nextBoltId++, owner: slotId, ownerIndex: slot.index,
    x: m.pos.x + m.dir.x * 0.15, y: m.pos.y + m.dir.y * 0.15,
    vx: m.dir.x * speed, vy: m.dir.y * speed,
  });
  physics.applyRecoil(slotId, m.pos, m.dir, effRecoil());
  renderer.addFlash(m.pos.x + m.dir.x * 0.2, m.pos.y + m.dir.y * 0.2, 'muzzle', slot.index);
  return { pos: m.pos, dir: m.dir };
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== undefined && e.button !== 0) return;
  if (!localSlot) return;
  // 몸이 빠르게 돌아 조준이 시간에 민감하다 → 지연 없이 로컬에서 먼저 쏘고 알린다
  const shot = fire(localSlot.id);
  if (shot && net) net.send('fire', { slot: localSlot.id, px: shot.pos.x, py: shot.pos.y, dx: shot.dir.x, dy: shot.dir.y });
});

function targetsOf() {
  const out = [];
  for (const s of aliveSlots()) {
    const snap = physics.get(s.id);
    if (snap) out.push({ id: s.id, pose: snap.pose, cap: shape, snap });
  }
  return out;
}

/** 봇이 노릴 상대 = 가장 가까운 생존자 */
function nearestOpponent(self, selfSnap) {
  let best = null;
  for (const s of aliveSlots()) {
    if (s.id === self.id) continue;
    const snap = physics.get(s.id);
    if (!snap) continue;
    const d = Math.hypot(snap.pose.x - selfSnap.pose.x, snap.pose.y - selfSnap.pose.y);
    if (!best || d < best.d) best = { d, snap };
  }
  return best ? best.snap : null;
}

function fixedStep(dt) {
  gameTime += dt;
  for (const s of slots) s.gate.update(dt);
  physics.step();

  // 봇
  if (gameTime >= tuning.spawnLock) {
    for (const s of aliveSlots()) {
      if (s.kind !== 'bot' || !isAuthority()) continue;
      const snap = physics.get(s.id);
      if (!snap) continue;
      const target = nearestOpponent(s, snap);
      if (!target) continue;
      const threats = tuning.aiDodgeLookahead > 0 ? bolts.filter((b) => b.owner !== s.id) : [];
      const d = decide(snap, target, {
        ...tuning, laserSpeed: effLaserSpeed(), recoilImpulse: effRecoil(),
        now: gameTime, canFire: s.gate.canFire(), cap: shape, bolts: threats,
      }, s.aiMem);
      if (d.fire) {
        const shot = fire(s.id);
        if (shot && net) net.send('fire', { slot: s.id, px: shot.pos.x, py: shot.pos.y, dx: shot.dir.x, dy: shot.dir.y });
      }
    }
  }

  // 탄
  const targets = targetsOf();
  const hits = [];
  const alive = [];
  for (const b of bolts) {
    const r = stepBolt(b, dt, targets, arena);
    renderer.addTrail(b.x, b.y, r.bolt.x, r.bolt.y, b.ownerIndex);
    if (r.hit) hits.push({ shooter: b.owner, ownerIndex: b.ownerIndex, targetId: r.hit.targetId, point: r.hit.point });
    else if (!r.dead) alive.push(r.bolt);
  }
  bolts = alive;
  // 명중은 쏜 쪽이 판정한다 — 남의 탄이 내 화면에서 맞아도 죽이지 않고 그쪽의 hit 을 기다린다
  let applied = 0;
  for (const h of hits) {
    if (!ownsSlot(h.shooter)) continue;
    applyHit(h);
    applied += 1;
    if (net) net.send('hit', { shooter: h.shooter, victim: h.targetId, px: h.point.x, py: h.point.y });
  }
  if (applied && isAuthority()) checkRoundEnd();
}

/** 명중 적용 — 쏜 쪽이 판정한다(네트워크에서도 같은 함수로 주입) */
function applyHit({ shooter, ownerIndex, targetId, point }) {
  const victim = slotById(targetId);
  if (!victim || !victim.alive) return;
  victim.alive = false;
  physics.removeBody(victim.id);
  const idx = ownerIndex ?? (slotById(shooter) ? slotById(shooter).index : 0);
  renderer.addFlash(point.x, point.y, 'hit', idx);
  syncScores();
}

function checkRoundEnd() {
  if (state !== 'playing') return;
  const survivors = aliveSlots();
  if (survivors.length > 1) return;

  timeScale = 1;
  state = 'roundEnd';
  bolts = [];

  if (survivors.length === 0) {
    broadcastState('roundEnd', { winner: -1 });
    hud.showBanner({ title: '전멸', text: '무득점 — 다시' });
    setTimeout(() => { round++; startRound(); broadcastState('round'); }, 1500);
    return;
  }

  const winner = survivors[0];
  winner.score++;
  syncScores();
  const color = SLOT_COLORS[winner.index % SLOT_COLORS.length].bolt;

  if (winner.score >= tuning.roundsToWin) {
    state = 'matchEnd';
    broadcastState('matchEnd', { winner: winner.index });
    hud.showBanner({
      title: winner.kind === 'local' ? '승리!' : winner.label + ' 승리',
      text: scoreLine(),
      color,
      buttons: [
        { label: '다시', onClick: () => startMatch(slots.map((s) => s.kind)) },
        { label: '처음 화면', onClick: () => (net ? enterWaiting() : showLobby()), secondary: true },
      ],
    });
    return;
  }
  broadcastState('roundEnd', { winner: winner.index });
  hud.showBanner({ title: winner.label + ' 라운드 획득', text: scoreLine(), color });
  setTimeout(() => { round++; startRound(); broadcastState('round'); }, 1500);
}

// ---- 네트워크 배선 ----
function broadcastState(phase, extra) {
  if (!net || !isAuthority()) return;
  net.send('state', Object.assign(
    { phase, round, owners: slotOwners, scores: slots.map((s) => s.score) },
    extra || {},
  ));
}

const applyScores = (d) => {
  if (!Array.isArray(d.scores)) return;
  slots.forEach((s, i) => { if (d.scores[i] != null) s.score = d.scores[i]; });
  syncScores();
};

/** 방장의 라운드 시작을 따른다. 슬롯 배치가 바뀌었으면 다시 만든다(친구 합류·이탈) */
function applyRoundStart(d) {
  const owners = Array.isArray(d.owners) && d.owners.length ? d.owners : slotOwners;
  const changed = owners.join(',') !== slotOwners.join(',');
  slotOwners = owners;
  round = d.round != null ? d.round : round;
  if (changed || mode !== 'online' || slots.length !== owners.length) {
    mode = 'online';
    startMatch(kindsFromOwners(slotOwners));
  } else {
    startRound();
  }
  applyScores(d);
}

/** 방장이 보내온 라운드·결과를 따른다 */
function applyRemoteState(d) {
  if (isAuthority()) return;
  if (d.phase === 'round') { applyRoundStart(d); return; }
  applyScores(d);
  const w = slots[d.winner];
  const color = w ? SLOT_COLORS[w.index % SLOT_COLORS.length].bolt : '';
  state = d.phase === 'matchEnd' ? 'matchEnd' : 'roundEnd';
  timeScale = 1;
  bolts = [];
  syncScores();
  if (d.winner === -1) {
    hud.showBanner({ title: '전멸', text: '무득점 — 다시' });
  } else if (d.phase === 'matchEnd') {
    hud.showBanner({
      title: w && w.kind === 'local' ? '승리!' : (w ? w.label : '?') + ' 승리',
      text: scoreLine(), color,
      buttons: [{ label: '대기실로', onClick: () => enterWaiting() }],
    });
  } else {
    hud.showBanner({ title: (w ? w.label : '?') + ' 라운드 획득', text: scoreLine(), color });
  }
}

/** 방장이 30Hz 로 전 슬롯 자세를 뿌리고, 나머지는 부드럽게 보정한다 */
function sendPoses() {
  const out = {};
  for (const slot of slots) {
    const snap = physics.get(slot.id);
    if (snap) out[slot.id] = [snap.pose.x, snap.pose.y, snap.pose.angle, snap.vel.x, snap.vel.y, snap.angvel];
  }
  net.send('pose', { s: out });
}

function applyPoses(d) {
  if (isAuthority() || !d || !d.s) return;
  for (const id of Object.keys(d.s)) {
    if (!physics.has(id)) continue;
    const a = d.s[id];
    const target = { x: a[0], y: a[1], angle: a[2], vx: a[3], vy: a[4], angvel: a[5] };
    if (localSlot && id === localSlot.id) {
      // 내 몸은 로컬 예측을 살리고, 많이 어긋났을 때만 끌어당긴다
      const snap = physics.get(id);
      const err = Math.hypot(snap.pose.x - target.x, snap.pose.y - target.y);
      if (err > 0.5) physics.correct(id, target, 0.3);
    } else {
      physics.correct(id, target, 0.35);
    }
  }
}

const scoreLine = () => slots.map((s) => s.label + ' ' + s.score).join(' · ');

function computeSlowmo() {
  if (state !== 'playing' || tuning.slowmoLookahead <= 0) return 1;
  const targets = targetsOf();
  for (const b of bolts) {
    for (const t of targets) {
      if (t.id !== b.owner && willHit(b, t, tuning.slowmoLookahead)) return tuning.slowmoScale;
    }
  }
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

  if (net && isAuthority() && state === 'playing') {
    poseTimer += dtReal;
    if (poseTimer >= POSE_INTERVAL) { poseTimer = 0; sendPoses(); }
  }

  const view = slots.map((s) => ({
    id: s.id, index: s.index, alive: s.alive, isLocal: s.kind === 'local',
    snap: s.alive ? physics.get(s.id) : null,
    gauge: s.alive ? s.gate.state() : null,
  }));
  renderer.render({ slots: view, bolts, timeScale, tuning, shape }, dtReal);
  hud.setGauge(localSlot && localSlot.alive ? localSlot.gate.state() : null);
  requestAnimationFrame(frame);
}

// ---- 시작 흐름: 혼자하기 / 함께하기 ----
function soloKinds() {
  const bots = Math.max(0, Math.min(SLOT_COLORS.length - 1, tuning.botCount));
  const kinds = ['local'];
  for (let i = 0; i < bots; i++) kinds.push('bot');
  return kinds;
}

/** 봇 수를 정해 혼자 하기 시작. n 을 주면 tuning 에도 반영해 다음에도 그 값이 기본이 된다 */
function startSolo(botCount) {
  if (typeof botCount === 'number') tuning.botCount = botCount;
  if (net) { net.leave(); net = null; }
  mode = 'solo';
  startMatch(soloKinds());
}

/** 시작 화면 → 봇 수 선택 */
function showLobby() {
  mode = 'lobby';
  state = 'idle';
  bolts = [];
  showStart(hud, {
    onSolo: () => showSoloSetup(hud, {
      current: tuning.botCount,
      onPick: startSolo,
      onBack: showLobby,
    }),
    onCoop: startCoop,
  });
}

/** 슬롯 주인 목록 → 내 관점의 종류. 'bot' 은 방장이 조작한다 */
function kindsFromOwners(owners) {
  return owners.map((o) => (o === 'bot' ? 'bot' : (net && o === net.selfId ? 'local' : 'remote')));
}

function enterWaiting() {
  mode = 'waiting';
  state = 'idle';
  bolts = [];
  showWaiting(hud, {
    code: roomFromUrl(), transport: net.transport, roster: net.roster,
    selfId: net.selfId, isHost: net.isHost(), botCount: Math.max(1, tuning.botCount),
    onStart: (opts) => requestStart(opts),
    onSolo: () => showSoloSetup(hud, { current: tuning.botCount, onPick: startSolo, onBack: enterWaiting }),
  });
}

/** 누구나 누르는 시작. 방장이면 바로, 아니면 방장에게 요청을 보낸다 */
function requestStart(opts) {
  const fillBots = !!(opts && opts.fillBots);
  if (isAuthority()) {
    startOnline({ fillBots });
    broadcastState('round');
  } else {
    net.send('state', { phase: 'startRequest', fillBots });
    hud.showBanner({ title: '시작 요청', text: '방장에게 시작을 요청했습니다…' });
  }
}

/** 방장만 호출. 사람 명단에 (원하면) 봇을 채워 슬롯 배치를 정하고 시작한다 */
function startOnline(opts) {
  if (opts && typeof opts.fillBots === 'boolean') onlineFillBots = opts.fillBots;
  mode = 'online';
  const owners = net.roster.slice(0, MAX_PLAYERS);
  if (onlineFillBots) {
    const want = Math.min(MAX_PLAYERS, 1 + Math.max(1, tuning.botCount));
    while (owners.length < want) owners.push('bot');
  }
  slotOwners = owners;
  startMatch(kindsFromOwners(slotOwners));
}

async function startCoop() {
  const transport = transportFromUrl();
  const creating = !roomFromUrl();          // URL 에 방이 없으면 내가 만드는 것
  const code = ensureRoom(transport);
  hud.showBanner({ title: '연결 중…', text: '방 ' + code });
  try {
    net = await createNet({ roomCode: code, transport, hostId: hostFromUrl() });
    if (creating) {
      // 방을 만든 사람이 방장 — 초대 링크에 내 id 를 실어 모두가 같은 결론을 내게 한다
      net.claimHost(net.selfId);
      markSelfAsHost(net.selfId);
    }
  } catch (err) {
    hud.showBanner({
      title: '연결 실패',
      text: String(err && err.message ? err.message : err),
      buttons: [{ label: '혼자 하기', onClick: showLobby }],
    });
    return;
  }
  net.on('fire', (d) => {
    if (mode !== 'online') return;
    fire(d.slot, { pos: { x: d.px, y: d.py }, dir: { x: d.dx, y: d.dy } });
  });
  net.on('hit', (d) => {
    if (mode !== 'online') return;
    const shooter = slotById(d.shooter);
    applyHit({ shooter: d.shooter, ownerIndex: shooter ? shooter.index : 0, targetId: d.victim, point: { x: d.px, y: d.py } });
    if (isAuthority()) checkRoundEnd();
  });
  net.on('pose', applyPoses);
  net.on('state', (d) => {
    // 누군가의 시작 요청 → 방장이 실제로 시작한다
    if (d.phase === 'startRequest') {
      if (isAuthority() && mode !== 'online') {
        startOnline({ fillBots: !!d.fillBots });
        broadcastState('round');
      }
      return;
    }
    // 대기실에 있는 참가자는 방장의 첫 'round' 를 받고 입장한다(이 메시지가 유일한 계기다)
    if (mode !== 'online') {
      if (d.phase !== 'round') return;
      applyRoundStart(d);
      return;
    }
    applyRemoteState(d);
  });
  net.onRoster(() => {
    if (mode === 'waiting') { enterWaiting(); return; }           // 인원 표시 갱신
    if (mode !== 'online' || !isAuthority()) return;
    // 사람이 들어오거나 나갔으면 방장이 슬롯을 다시 짜고 새 라운드로 알린다
    const humans = slotOwners.filter((o) => o !== 'bot');
    const same = humans.length === net.roster.length && humans.every((id, i) => id === net.roster[i]);
    if (!same) { startOnline(); broadcastState('round'); }
  });
  enterWaiting();
}

if (roomFromUrl()) startCoop();                                   // 초대 링크로 들어옴 → 대기실
else showLobby();
requestAnimationFrame(frame);

// 디버그 훅
window.__rd = {
  state: () => state,
  slots: () => slots.map((s) => ({ id: s.id, index: s.index, kind: s.kind, score: s.score, alive: s.alive })),
  arena: () => arena,
  gameTime: () => gameTime,
  body: (id) => physics.get(id),
  bolts: () => bolts,
  mode: () => mode,
  roster: () => (net ? net.roster : []),
  isHost: () => isAuthority(),
  selfId: () => (net ? net.selfId : null),
  owners: () => slotOwners,
  requestStart,
  fire, startRound, startMatch, soloKinds, startSolo, startCoop, enterWaiting, startOnline, showLobby,
};
