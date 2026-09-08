import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rosterOf, slotIndexOf, hostOf, makeRoomCode, MAX_PLAYERS } from '../src/net.js';

test('rosterOf: 정렬된 명단이라 누가 계산해도 같다', () => {
  const a = rosterOf('bbb', ['aaa', 'ccc']);
  const b = rosterOf('aaa', ['ccc', 'bbb']);
  const c = rosterOf('ccc', ['bbb', 'aaa']);
  assert.deepEqual(a, ['aaa', 'bbb', 'ccc']);
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test('rosterOf: 최대 인원까지만, 빈 값은 무시', () => {
  const r = rosterOf('a', ['b', 'c', 'd', 'e', 'f', null, undefined]);
  assert.equal(r.length, MAX_PLAYERS);
});

test('slotIndexOf: 명단 순서가 슬롯 인덱스', () => {
  const r = rosterOf('bbb', ['aaa', 'ccc']);
  assert.equal(slotIndexOf(r, 'aaa'), 0);
  assert.equal(slotIndexOf(r, 'bbb'), 1);
  assert.equal(slotIndexOf(r, 'ccc'), 2);
  assert.equal(slotIndexOf(r, 'zzz'), -1);
});

test('hostOf: 명단 0번이 방장 — 모든 참가자가 같은 결론', () => {
  const r1 = rosterOf('bbb', ['aaa']);
  const r2 = rosterOf('aaa', ['bbb']);
  assert.equal(hostOf(r1), 'aaa');
  assert.equal(hostOf(r2), 'aaa');
});

test('hostOf: 방장이 나가면 다음 사람이 자동 승계', () => {
  assert.equal(hostOf(rosterOf('bbb', ['ccc'])), 'bbb');
});

test('makeRoomCode: 길이와 헷갈리는 문자 제외', () => {
  for (let i = 0; i < 200; i++) {
    const c = makeRoomCode(4);
    assert.equal(c.length, 4);
    assert.ok(/^[A-HJ-NP-Z2-9]+$/.test(c), `모호한 문자 포함: ${c}`);
  }
});

test('makeRoomCode: 충돌이 잦지 않다', () => {
  const set = new Set(Array.from({ length: 300 }, () => makeRoomCode(4)));
  assert.ok(set.size > 280, `중복 과다: ${set.size}/300`);
});
