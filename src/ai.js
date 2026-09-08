// AI 결정(순수). 몸 회전은 반동으로만 바뀌므로 AI 가 할 수 있는 건 "지금 쏠까 말까" 하나다.
// 1) 명중 예측: 지금 쏘면 그 탄이 (표적 속도로 예측한) 표적 몸에 실제로 닿는가 — 선분-캡슐 스윕.
// 2) 회피 사격: 날아오는 표적 탄이 나에게 맞을 궤적이면, 반동으로 이동한 뒤 위치가 피해지는지 보고 즉시 쏜다.
// 3) 재배치: 좋은 각이 오래 없으면 반동 회전이 총구를 표적 쪽으로 돌려주는 방향일 때 쏜다.
import { localToWorld, rotate, wrapAngle, segmentCapsuleHit } from './geom.js';

const DEFAULT_CAP = { halfHeight: 0, radius: 0.45 };

/** 총구 월드 위치와 방향각. facing = +1(오른쪽) / -1(왼쪽) */
export function muzzleOf(self, cfg) {
  const pos = localToWorld(self.pose, { x: self.facing * cfg.gunOffsetX, y: cfg.gunOffsetY });
  const dir = rotate({ x: self.facing, y: 0 }, self.pose.angle);
  return { pos, dir, angle: Math.atan2(dir.y, dir.x) };
}

/** 리드 보정한 목표 방향과 현재 총구 방향의 각 오차 (rad, 부호 있음) */
export function aimError(self, target, cfg) {
  const m = muzzleOf(self, cfg);
  let px = target.pose.x, py = target.pose.y;
  for (let i = 0; i < 2; i++) {
    const t = Math.hypot(px - m.pos.x, py - m.pos.y) / cfg.laserSpeed;
    px = target.pose.x + target.vel.x * t;
    py = target.pose.y + target.vel.y * t;
  }
  const desired = Math.atan2(py - m.pos.y, px - m.pos.x);
  return wrapAngle(desired - m.angle);
}

/** 지금 쏘면 맞는가: 비행시간만큼 표적을 이동시킨 자세에 대해 탄 궤적을 스윕 */
export function predictHit(self, target, cfg) {
  const cap = cfg.cap ?? DEFAULT_CAP;
  const m = muzzleOf(self, cfg);
  const dist = Math.hypot(target.pose.x - m.pos.x, target.pose.y - m.pos.y);
  const t = dist / cfg.laserSpeed;
  const predicted = { x: target.pose.x + target.vel.x * t, y: target.pose.y + target.vel.y * t, angle: target.pose.angle + (target.angvel ?? 0) * t };
  const reach = cfg.laserSpeed * Math.max(t * 1.5, 0.2);
  const end = { x: m.pos.x + m.dir.x * reach, y: m.pos.y + m.dir.y * reach };
  return segmentCapsuleHit(m.pos, end, predicted, cap) !== null;
}

/** 반동으로 생기는 회전 방향 부호(총이 어깨 위에 있으면 facing 과 같다) */
export function recoilSpinSign(self, cfg) {
  return Math.sign(self.facing * cfg.gunOffsetY) || 1;
}

/** 날아오는 탄 중 나에게 맞을 것이 있는가, 그리고 지금 쏘면(반동) 피해지는가 */
export function dodgeDecision(self, bolts, cfg) {
  const cap = cfg.cap ?? DEFAULT_CAP;
  const lookahead = cfg.aiDodgeLookahead ?? 0.45;
  let threat = null;
  for (const b of bolts) {
    const to = { x: b.x + b.vx * lookahead, y: b.y + b.vy * lookahead };
    const h = segmentCapsuleHit({ x: b.x, y: b.y }, to, self.pose, cap);
    if (h && (!threat || h.t < threat.t)) threat = { ...h, bolt: b };
  }
  if (!threat) return { threatened: false, fire: false };
  // 반동 후 속도로 명중 시각까지 이동한 위치에서 다시 판정
  const m = muzzleOf(self, cfg);
  const J = cfg.recoilImpulse ?? 6;
  const tHit = threat.t * lookahead;
  const vx = self.vel.x - m.dir.x * J, vy = self.vel.y - m.dir.y * J; // 질량 1
  const moved = { x: self.pose.x + vx * tHit, y: self.pose.y + vy * tHit, angle: self.pose.angle };
  const b = threat.bolt;
  const to = { x: b.x + b.vx * lookahead, y: b.y + b.vy * lookahead };
  const stillHit = segmentCapsuleHit({ x: b.x, y: b.y }, to, moved, cap) !== null;
  return { threatened: true, fire: !stillHit };
}

/**
 * @param ctx { now, canFire, laserSpeed, gunOffsetX, gunOffsetY, aiToleranceDeg, aiReaction, aiRepositionAfter, cap?, bolts?, recoilImpulse? }
 * @param mem 프레임 간 기억 { onTargetSince: number|null, lastGoodAt: number } — 호출자가 보관, 여기서 변이
 * @returns { fire: boolean, reason: 'aim'|'dodge'|'reposition'|null, error: rad }
 */
export function decide(self, target, ctx, mem) {
  const err = aimError(self, target, ctx);
  const tol = (ctx.aiToleranceDeg * Math.PI) / 180;
  const onTarget = Math.abs(err) <= tol || predictHit(self, target, ctx);

  // 2) 회피 — 표적 위 판정보다 우선(죽으면 끝)
  if (ctx.canFire && ctx.bolts && ctx.bolts.length) {
    const d = dodgeDecision(self, ctx.bolts, ctx);
    if (d.fire) { mem.lastGoodAt = ctx.now; return { fire: true, reason: 'dodge', error: err }; }
  }

  if (onTarget) {
    if (mem.onTargetSince == null) mem.onTargetSince = ctx.now;
    mem.lastGoodAt = ctx.now;
    if (ctx.canFire && ctx.now - mem.onTargetSince >= ctx.aiReaction) {
      return { fire: true, reason: 'aim', error: err };
    }
    return { fire: false, reason: null, error: err };
  }

  mem.onTargetSince = null;
  // 3) 재배치: 반동 회전이 오차를 줄이는 방향이거나, 지금 표적에서 멀어지는 쪽으로 돌고 있을 때
  if (ctx.canFire && ctx.now - mem.lastGoodAt >= ctx.aiRepositionAfter) {
    const spin = recoilSpinSign(self, ctx);
    const helps = Math.sign(err) === spin || (self.angvel ?? 0) * err < 0;
    if (helps) {
      mem.lastGoodAt = ctx.now;
      return { fire: true, reason: 'reposition', error: err };
    }
  }
  return { fire: false, reason: null, error: err };
}
