import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rotate, localToWorld, segmentCapsuleHit, capsuleSegment } from '../src/geom.js';

const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
const CAP = { halfHeight: 0.35, radius: 0.25 };

test('rotate: 90° 회전', () => {
  const v = rotate({ x: 1, y: 0 }, Math.PI / 2);
  assert.ok(near(v.x, 0) && near(v.y, 1));
});

test('localToWorld: 몸 위치·각 적용', () => {
  const p = localToWorld({ x: 2, y: 3, angle: Math.PI / 2 }, { x: 1, y: 0 });
  assert.ok(near(p.x, 2) && near(p.y, 4));
});

test('capsuleSegment: 서 있는 캡슐의 축 선분은 세로', () => {
  const { a, b } = capsuleSegment({ x: 0, y: 0, angle: 0 }, CAP);
  assert.ok(near(a.x, 0) && near(b.x, 0));
  assert.ok(near(Math.abs(a.y - b.y), 2 * CAP.halfHeight));
});

test('segmentCapsuleHit: 정면 명중은 t 를 돌려주고, 빗나가면 null', () => {
  const pose = { x: 5, y: 0, angle: 0 };
  const hit = segmentCapsuleHit({ x: 0, y: 0 }, { x: 10, y: 0 }, pose, CAP);
  assert.ok(hit && hit.t > 0.4 && hit.t < 0.5, `t=${hit?.t}`);
  assert.equal(segmentCapsuleHit({ x: 0, y: 2 }, { x: 10, y: 2 }, pose, CAP), null);
});

test('segmentCapsuleHit: 옆으로 누운 캡슐은 가로로 길다', () => {
  const pose = { x: 5, y: 0, angle: Math.PI / 2 };
  assert.ok(segmentCapsuleHit({ x: 5.5, y: -3 }, { x: 5.5, y: 3 }, pose, CAP), '축 선분 안쪽 x=5.5');
  assert.equal(segmentCapsuleHit({ x: 5.5, y: -3 }, { x: 5.5, y: 3 }, { x: 5, y: 0, angle: 0 }, CAP), null, '서 있으면 x=5.5 는 반지름 밖');
});

test('segmentCapsuleHit: 시작점이 이미 안에 있으면 t=0', () => {
  const hit = segmentCapsuleHit({ x: 5, y: 0 }, { x: 6, y: 0 }, { x: 5, y: 0, angle: 0 }, CAP);
  assert.equal(hit.t, 0);
});

test('segmentCapsuleHit: 구간이 캡슐에 못 미치면 null', () => {
  assert.equal(segmentCapsuleHit({ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0, angle: 0 }, CAP), null);
});
