import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFireGate } from '../src/firegate.js';

const cfg = (over = {}) => ({ fireMode: 'cooldown', cooldown: 0.5, energyMax: 3, energyRegen: 1.2, ...over });

test('cooldown: 첫 발 허용, 직후 거부, 시간 지나면 허용', () => {
  const t = cfg();
  const g = createFireGate(t);
  assert.equal(g.tryFire(), true);
  assert.equal(g.tryFire(), false);
  g.update(0.3);
  assert.equal(g.tryFire(), false);
  g.update(0.25);
  assert.equal(g.tryFire(), true);
});

test('cooldown: state 는 0..1 진행률을 준다', () => {
  const g = createFireGate(cfg());
  g.tryFire();
  g.update(0.25);
  const s = g.state();
  assert.equal(s.mode, 'cooldown');
  assert.ok(Math.abs(s.ready - 0.5) < 1e-9);
});

test('energy: 3발 연속 뒤 거부, 충전되면 다시 허용', () => {
  const g = createFireGate(cfg({ fireMode: 'energy' }));
  assert.equal(g.tryFire(), true);
  assert.equal(g.tryFire(), true);
  assert.equal(g.tryFire(), true);
  assert.equal(g.tryFire(), false);
  g.update(1.2);
  assert.equal(g.tryFire(), true);
  assert.equal(g.tryFire(), false);
});

test('energy: state 는 에너지 잔량을 준다', () => {
  const g = createFireGate(cfg({ fireMode: 'energy' }));
  g.tryFire();
  g.update(0.6);
  const s = g.state();
  assert.equal(s.mode, 'energy');
  assert.ok(Math.abs(s.energy - 2.5) < 1e-9 && s.max === 3);
});

test('모드 전환: tuning 객체를 바꾸면 다음 판정부터 반영', () => {
  const t = cfg();
  const g = createFireGate(t);
  g.tryFire();
  t.fireMode = 'energy';
  assert.equal(g.tryFire(), true, '에너지 모드는 잔량으로만 판정');
});

test('reset 은 즉시 발사 가능 상태로', () => {
  const g = createFireGate(cfg());
  g.tryFire();
  g.reset();
  assert.equal(g.tryFire(), true);
});
