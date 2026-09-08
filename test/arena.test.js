import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arenaFor, spawnsFor } from '../src/arena.js';

const T = { arenaWidthPerPlayer: 3, scaleWithArena: true };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

test('arenaFor: 2인 이하는 기본 16×9', () => {
  for (const n of [1, 2]) {
    const a = arenaFor(n, T);
    assert.ok(near(a.width, 16) && near(a.height, 9), `${n}인: ${a.width}×${a.height}`);
    assert.ok(near(a.speedScale, 1));
  }
});

test('arenaFor: 인원이 늘면 16:9 비율을 지키며 넓어진다', () => {
  const a3 = arenaFor(3, T), a4 = arenaFor(4, T);
  assert.ok(near(a3.width, 19) && near(a4.width, 22));
  for (const a of [a3, a4]) assert.ok(near(a.height, a.width * 9 / 16), '비율 16:9');
  assert.ok(a4.width > a3.width && a3.width > 16);
});

test('arenaFor: speedScale = 방폭/16, 토글을 끄면 항상 1', () => {
  assert.ok(near(arenaFor(4, T).speedScale, 22 / 16));
  assert.ok(near(arenaFor(4, { ...T, scaleWithArena: false }).speedScale, 1));
});

test('arenaFor: halfW/halfH 는 폭·높이의 절반', () => {
  const a = arenaFor(4, T);
  assert.ok(near(a.halfW, a.width / 2) && near(a.halfH, a.height / 2));
});

test('spawnsFor: 2인은 대각선으로 마주본다', () => {
  const a = arenaFor(2, T);
  const s = spawnsFor(['p0', 'p1'], a);
  assert.equal(Object.keys(s).length, 2);
  assert.ok(s.p0.x < 0 && s.p0.y > 0, '좌상');
  assert.ok(s.p1.x > 0 && s.p1.y < 0, '우하');
  assert.equal(s.p0.facing, 1);
  assert.equal(s.p1.facing, -1);
});

test('spawnsFor: 4인은 네 모서리, 모두 방 안쪽(여유 1m)에 들어온다', () => {
  const a = arenaFor(4, T);
  const s = spawnsFor(['p0', 'p1', 'p2', 'p3'], a);
  assert.equal(Object.keys(s).length, 4);
  const xs = new Set(), ys = new Set();
  for (const v of Object.values(s)) {
    assert.ok(Math.abs(v.x) <= a.halfW - 1 + 1e-9, `x ${v.x} 안쪽`);
    assert.ok(Math.abs(v.y) <= a.halfH - 1 + 1e-9, `y ${v.y} 안쪽`);
    assert.ok(v.facing === 1 || v.facing === -1);
    xs.add(Math.sign(v.x)); ys.add(Math.sign(v.y));
  }
  assert.deepEqual([...xs].sort(), [-1, 1], '좌우 양쪽 사용');
  assert.deepEqual([...ys].sort(), [-1, 1], '상하 양쪽 사용');
});

test('spawnsFor: 왼쪽 스폰은 오른쪽(+1), 오른쪽 스폰은 왼쪽(-1)을 본다', () => {
  const a = arenaFor(4, T);
  for (const v of Object.values(spawnsFor(['p0', 'p1', 'p2', 'p3'], a))) {
    assert.equal(v.facing, v.x < 0 ? 1 : -1);
  }
});

test('spawnsFor: 서로 충분히 떨어져 있다(최소 간격 > 몸 지름 2배)', () => {
  const a = arenaFor(4, T);
  const v = Object.values(spawnsFor(['p0', 'p1', 'p2', 'p3'], a));
  for (let i = 0; i < v.length; i++) {
    for (let j = i + 1; j < v.length; j++) {
      assert.ok(Math.hypot(v[i].x - v[j].x, v[i].y - v[j].y) > 1.8);
    }
  }
});
