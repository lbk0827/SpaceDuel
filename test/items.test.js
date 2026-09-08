import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_DEFS, ITEM_KINDS, ITEM_RADIUS, emptyMods, applyItem, consumeBarrier,
  effectiveStats, spawnShip, stepShip, stepItems, pickups, nextKind,
} from '../src/items.js';

const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const arena = { halfW: 8, halfH: 4.5, width: 16, height: 9 };
const T = { itemShipSpeed: 6, itemsPerPass: 2, itemSpdStep: 0.35 };
const base = { laserSpeed: 13, fireMode: 'cooldown', energyMax: 3 };

test('applyItem: 누적되고 상한을 넘지 않으며 원본을 변이하지 않는다', () => {
  const m0 = emptyMods();
  let m = applyItem(m0, 'barrier');
  assert.equal(m.barrier, 1);
  assert.equal(m0.barrier, 0, '원본 불변');
  for (let i = 0; i < 10; i++) m = applyItem(m, 'barrier');
  assert.equal(m.barrier, ITEM_DEFS.barrier.max);
});

test('applyItem: 알 수 없는 종류는 무시', () => {
  assert.deepEqual(applyItem(emptyMods(), 'nope'), emptyMods());
});

test('consumeBarrier: 있으면 막고 1 줄이고, 없으면 못 막는다', () => {
  const m = applyItem(emptyMods(), 'barrier');
  const r1 = consumeBarrier(m);
  assert.equal(r1.blocked, true);
  assert.equal(r1.mods.barrier, 0);
  const r2 = consumeBarrier(r1.mods);
  assert.equal(r2.blocked, false);
});

test('effectiveStats: 기본은 그대로', () => {
  const s = effectiveStats(emptyMods(), base, T);
  assert.ok(near(s.laserSpeed, 13));
  assert.equal(s.fireMode, 'cooldown');
  assert.equal(s.energyMax, 3);
  assert.equal(s.barrier, 0);
});

test('effectiveStats: 속도 아이템은 한 개당 +35% 누적', () => {
  let m = applyItem(emptyMods(), 'weaponSpd');
  assert.ok(near(effectiveStats(m, base, T).laserSpeed, 13 * 1.35));
  m = applyItem(m, 'weaponSpd');
  assert.ok(near(effectiveStats(m, base, T).laserSpeed, 13 * 1.7));
});

test('effectiveStats: 탄창을 먹으면 에너지 모드 + 탄약 1+개수 (최대 4)', () => {
  let m = applyItem(emptyMods(), 'magazine');
  let s = effectiveStats(m, base, T);
  assert.equal(s.fireMode, 'energy');
  assert.equal(s.energyMax, 2, '첫 개 = 2발 연사');
  m = applyItem(m, 'magazine');
  assert.equal(effectiveStats(m, base, T).energyMax, 3);
  m = applyItem(applyItem(m, 'magazine'), 'magazine');
  assert.equal(effectiveStats(m, base, T).energyMax, 4, '상한 4');
});

test('spawnShip: 방 밖에서 시작해 안쪽으로 향하고, 투하 지점은 방 안에 균등 분포', () => {
  const ship = spawnShip(arena, T, () => 0.1);   // dir = +1
  assert.equal(ship.dir, 1);
  assert.ok(ship.x < -arena.halfW, '왼쪽 밖에서 시작');
  assert.equal(ship.dropXs.length, 2);
  for (const x of ship.dropXs) assert.ok(Math.abs(x) < arena.halfW, `투하 x ${x} 방 안`);
  assert.ok(ship.dropXs[0] < ship.dropXs[1], '진행 방향 순서');
  assert.ok(ship.y > 0 && ship.y < arena.halfH, '위쪽 절반');
});

test('spawnShip: 반대 방향도 대칭으로 동작', () => {
  const ship = spawnShip(arena, T, () => 0.9);
  assert.equal(ship.dir, -1);
  assert.ok(ship.x > arena.halfW);
  assert.ok(ship.dropXs[0] > ship.dropXs[1], '진행 방향 순서(오른→왼)');
});

test('stepShip: 투하 지점을 지날 때 한 번만 떨어뜨리고, 방을 벗어나면 done', () => {
  let ship = spawnShip(arena, T, () => 0.1);
  const total = ship.dropXs.length;
  let dropped = 0, guard = 0;
  while (ship && guard++ < 500) {
    const r = stepShip(ship, 1 / 60, arena);
    dropped += r.drops.length;
    ship = r.ship;
  }
  assert.equal(dropped, total, '투하 수 = 예정 수');
  assert.equal(ship, null, '방을 벗어나면 사라진다');
});

test('stepItems: 수명이 지나면 사라진다', () => {
  const items = [{ id: 1, kind: 'barrier', x: 0, y: 0, age: 0 }];
  let cur = stepItems(items, 5, 20);
  assert.equal(cur.length, 1);
  assert.equal(cur[0].age, 5);
  cur = stepItems(cur, 16, 20);
  assert.equal(cur.length, 0);
});

test('stepItems: 수명 0 이면 영구히 남는다', () => {
  const cur = stepItems([{ id: 1, kind: 'barrier', x: 0, y: 0, age: 100 }], 1, 0);
  assert.equal(cur.length, 1);
});

test('pickups: 닿으면 획득, 멀면 안 됨', () => {
  const items = [{ id: 7, kind: 'barrier', x: 0, y: 0, age: 0 }];
  const touching = pickups(items, [{ id: 'p0', x: 0.5, y: 0, radius: 0.45 }]);
  assert.deepEqual(touching, [{ itemId: 7, slotId: 'p0', kind: 'barrier' }]);
  assert.deepEqual(pickups(items, [{ id: 'p0', x: 3, y: 0, radius: 0.45 }]), []);
});

test('pickups: 경계 — 반지름 합 안/밖', () => {
  const items = [{ id: 1, kind: 'barrier', x: 0, y: 0, age: 0 }];
  const r = 0.45, edge = r + ITEM_RADIUS;
  assert.equal(pickups(items, [{ id: 'p0', x: edge - 0.01, y: 0, radius: r }]).length, 1);
  assert.equal(pickups(items, [{ id: 'p0', x: edge + 0.01, y: 0, radius: r }]).length, 0);
});

test('pickups: 두 명이 동시에 닿으면 가까운 쪽만', () => {
  const items = [{ id: 1, kind: 'magazine', x: 0, y: 0, age: 0 }];
  const got = pickups(items, [
    { id: 'p0', x: 0.7, y: 0, radius: 0.45 },
    { id: 'p1', x: -0.3, y: 0, radius: 0.45 },
  ]);
  assert.equal(got.length, 1);
  assert.equal(got[0].slotId, 'p1');
});

test('nextKind: 세 종류를 순환한다', () => {
  const seq = [0, 1, 2, 3, 4].map(nextKind);
  assert.deepEqual(seq.slice(0, 3), ITEM_KINDS);
  assert.equal(seq[3], ITEM_KINDS[0]);
});
