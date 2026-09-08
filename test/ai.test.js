import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, aimError, predictHit, dodgeDecision } from '../src/ai.js';

const deg = (d) => (d * Math.PI) / 180;
const cfg = { laserSpeed: 25, aiToleranceDeg: 6, aiReaction: 0.15, aiRepositionAfter: 2.0, gunOffsetX: 0.45, gunOffsetY: 0.3 };
const self = (angle, facing = -1) => ({ pose: { x: 5, y: 3, angle }, vel: { x: 0, y: 0 }, facing });
const tgt = (x, y, vx = 0, vy = 0) => ({ pose: { x, y, angle: 0 }, vel: { x: vx, y: vy } });

test('aimError: 왼쪽을 보는(facing -1) AI 가 각 0 이면 정확히 왼쪽 표적을 향한다', () => {
  const e = aimError(self(0), tgt(-3, 3), cfg);
  assert.ok(Math.abs(e) < deg(3), `오차 ${e}`); // 총구가 어깨 높이(+0.3)라 수평선과 약 2° 차이
});

test('decide: 정지 표적이 허용각 안이고 반응 지연이 지났으면 fire', () => {
  const mem = { onTargetSince: 0, lastGoodAt: 0 };
  const d = decide(self(0), tgt(-3, 3), { ...cfg, now: 1.0, canFire: true }, mem);
  assert.equal(d.fire, true);
});

test('decide: 표적이 허용각 밖이면 안 쏜다(재배치 시간 전)', () => {
  const mem = { onTargetSince: null, lastGoodAt: 0.9 };
  const d = decide(self(deg(90)), tgt(-3, 3), { ...cfg, now: 1.0, canFire: true }, mem);
  assert.equal(d.fire, false);
});

test('decide: 반응 지연 동안은 표적 위라도 안 쏜다', () => {
  const mem = { onTargetSince: null, lastGoodAt: 0 };
  const d1 = decide(self(0), tgt(-3, 3), { ...cfg, now: 1.0, canFire: true }, mem);
  assert.equal(d1.fire, false, '이제 막 표적 위에 올라옴');
  const d2 = decide(self(0), tgt(-3, 3), { ...cfg, now: 1.2, canFire: true }, mem);
  assert.equal(d2.fire, true, '0.15s 지남');
});

test('decide: 좋은 각이 오래 없으면 재배치 사격', () => {
  const mem = { onTargetSince: null, lastGoodAt: 0 };
  const d = decide(self(deg(90)), tgt(-3, 3), { ...cfg, now: 2.5, canFire: true }, mem);
  assert.equal(d.fire, true);
  assert.equal(d.reason, 'reposition');
});

test('decide: canFire 가 false 면 절대 안 쏜다', () => {
  const mem = { onTargetSince: 0, lastGoodAt: 0 };
  const d = decide(self(0), tgt(-3, 3), { ...cfg, now: 5, canFire: false }, mem);
  assert.equal(d.fire, false);
});

test('aimError: 움직이는 표적은 리드한다', () => {
  // 표적이 위로 빠르게 움직이면 조준 목표는 현재 위치보다 위 → 각 0(수평) 은 오차가 생긴다
  const still = Math.abs(aimError(self(0), tgt(-3, 3), cfg));
  const moving = Math.abs(aimError(self(0), tgt(-3, 3, 0, 8), cfg));
  assert.ok(moving > still + deg(5));
});

const CAP = { halfHeight: 0, radius: 0.45 };

test('predictHit: 정면 표적은 true, 옆으로 빗나가면 false', () => {
  assert.equal(predictHit(self(0), tgt(-3, 3), { ...cfg, cap: CAP }), true);
  assert.equal(predictHit(self(0), tgt(-3, 6), { ...cfg, cap: CAP }), false);
});

test('predictHit: 표적이 움직이면 도착 시점 위치로 판정한다', () => {
  // 총구는 왼쪽 수평. 표적은 현재 조금 위(빗나감)지만 아래로 내려오고 있어 도착 시엔 맞는다
  const t = { pose: { x: -3, y: 4.0, angle: 0 }, vel: { x: 0, y: -3 } }; // 8m/25 ≈ 0.32s → y ≈ 3.04
  assert.equal(predictHit(self(0), t, { ...cfg, cap: CAP }), true);
  assert.equal(predictHit(self(0), { ...t, vel: { x: 0, y: 0 } }, { ...cfg, cap: CAP }), false);
});

test('dodgeDecision: 나를 향한 탄이 있고 반동으로 피해지면 fire', () => {
  const me = { pose: { x: 5, y: 3, angle: 0 }, vel: { x: 0, y: 0 }, facing: -1 }; // 총구 왼쪽 → 반동은 오른쪽(+x)
  const bolt = { owner: 'player', x: 0, y: 3.2, vx: 25, vy: 0 };       // 왼쪽에서 날아옴, 0.2s 뒤 도달
  const d = dodgeDecision(me, [bolt], { ...cfg, cap: CAP, recoilImpulse: 6, aiDodgeLookahead: 0.45 });
  assert.equal(d.threatened, true);
  // 오른쪽으로 밀리면 탄 경로(수평선)에서 벗어나지 않음 → 피하지 못함 → fire false
  assert.equal(d.fire, false);
  // 총구가 아래를 보면 반동은 위로 → 피함
  const meDown = { ...me, pose: { x: 5, y: 3, angle: Math.PI / 2 } }; // facing -1, +90° → (0,-1) 아래
  const d2 = dodgeDecision(meDown, [bolt], { ...cfg, cap: CAP, recoilImpulse: 6, aiDodgeLookahead: 0.45 });
  assert.equal(d2.fire, true);
});

test('dodgeDecision: 위협 없으면 threatened false', () => {
  const me = { pose: { x: 5, y: 3, angle: 0 }, vel: { x: 0, y: 0 }, facing: -1 };
  assert.equal(dodgeDecision(me, [{ owner: 'player', x: 0, y: 8, vx: 25, vy: 0 }], { ...cfg, cap: CAP }).threatened, false);
});

test('decide: 회피가 조준보다 우선한다', () => {
  const meDown = { pose: { x: 5, y: 3, angle: Math.PI / 2 }, vel: { x: 0, y: 0 }, facing: -1 };
  const bolt = { owner: 'player', x: 0, y: 3.2, vx: 25, vy: 0 };
  const mem = { onTargetSince: null, lastGoodAt: 0 };
  const d = decide(meDown, tgt(-3, 3), { ...cfg, cap: CAP, recoilImpulse: 6, aiDodgeLookahead: 0.45, bolts: [bolt], now: 0.1, canFire: true }, mem);
  assert.equal(d.reason, 'dodge');
});
