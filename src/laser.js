// 레이저 탄. 물리 엔진 밖에서 순수 스윕으로 진행한다 (결정적, 터널링 없음).
// bolt = { id, owner, x, y, vx, vy }. target = { id, pose, cap }. arena = { halfW, halfH }.
import { segmentCapsuleHit } from './geom.js';

/** 한 스텝 진행. 표적 명중이면 hit, 벽을 넘으면 dead. */
export function stepBolt(bolt, dt, targets, arena) {
  const from = { x: bolt.x, y: bolt.y };
  const to = { x: bolt.x + bolt.vx * dt, y: bolt.y + bolt.vy * dt };

  let best = null;
  for (const tg of targets) {
    if (tg.id === bolt.owner) continue;
    const h = segmentCapsuleHit(from, to, tg.pose, tg.cap);
    if (h && (!best || h.t < best.t)) best = { ...h, targetId: tg.id };
  }
  if (best) {
    return { bolt: { ...bolt, x: best.point.x, y: best.point.y }, hit: { targetId: best.targetId, point: best.point }, dead: true };
  }

  const dead = Math.abs(to.x) > arena.halfW || Math.abs(to.y) > arena.halfH;
  return { bolt: { ...bolt, x: to.x, y: to.y }, hit: null, dead };
}

/** lookahead 초 뒤까지의 진행선이 표적(현재 자세)과 교차하는가 — 슬로모션 판정 */
export function willHit(bolt, target, lookahead) {
  if (target.id === bolt.owner) return false;
  const to = { x: bolt.x + bolt.vx * lookahead, y: bolt.y + bolt.vy * lookahead };
  return segmentCapsuleHit({ x: bolt.x, y: bolt.y }, to, target.pose, target.cap) !== null;
}
