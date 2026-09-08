import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepBolt, willHit } from '../src/laser.js';

const CAP = { halfHeight: 0.35, radius: 0.25 };
const arena = { halfW: 8, halfH: 4.5 };
const bolt = (over = {}) => ({ id: 1, owner: 'player', x: 0, y: 0, vx: 25, vy: 0, ...over });
const target = (x, y, angle = 0) => ({ id: 'ai', pose: { x, y, angle }, cap: CAP });

test('stepBolt: 아무것도 없으면 전진', () => {
  const r = stepBolt(bolt(), 0.1, [], arena);
  assert.ok(Math.abs(r.bolt.x - 2.5) < 1e-9);
  assert.equal(r.hit, null);
  assert.equal(r.dead, false);
});

test('stepBolt: 진행 구간에 표적이 있으면 명중 + 표적 id', () => {
  const r = stepBolt(bolt(), 0.1, [target(2, 0)], arena);
  assert.equal(r.hit?.targetId, 'ai');
  assert.ok(r.hit.point.x < 2, '캡슐 앞면에서 멈춤');
});

test('stepBolt: 자기 몸(owner) 은 무시', () => {
  const r = stepBolt(bolt(), 0.1, [{ id: 'player', pose: { x: 1, y: 0, angle: 0 }, cap: CAP }], arena);
  assert.equal(r.hit, null);
});

test('stepBolt: 벽을 넘으면 dead', () => {
  const r = stepBolt(bolt({ x: 7.9 }), 0.1, [], arena);
  assert.equal(r.dead, true);
});

test('willHit: 예측 구간 안에 표적이 있으면 true, 없으면 false', () => {
  assert.equal(willHit(bolt(), target(5, 0), 0.25), true, '25×0.25 = 6.25m 안');
  assert.equal(willHit(bolt(), target(8, 0), 0.25), false, '6.25m 밖');
  assert.equal(willHit(bolt(), target(5, 3), 0.25), false, '옆으로 빗나감');
});
