// 순수 2D 기하. 자세(pose) = { x, y, angle }. 캡슐(cap) = { halfHeight, radius } — 축은 로컬 y.

export function rotate(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

export function localToWorld(pose, local) {
  const r = rotate(local, pose.angle);
  return { x: pose.x + r.x, y: pose.y + r.y };
}

/** 각도를 (-π, π] 로 */
export function wrapAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a <= -Math.PI) a += 2 * Math.PI;
  return a;
}

/** 캡슐 축 선분의 양 끝(월드) */
export function capsuleSegment(pose, cap) {
  const up = rotate({ x: 0, y: cap.halfHeight }, pose.angle);
  return { a: { x: pose.x - up.x, y: pose.y - up.y }, b: { x: pose.x + up.x, y: pose.y + up.y } };
}

/** 점 p 와 선분 ab 의 거리 */
export function pointSegmentDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const L2 = abx * abx + aby * aby;
  let t = L2 === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / L2;
  t = Math.max(0, Math.min(1, t));
  const cx = a.x + abx * t, cy = a.y + aby * t;
  return Math.hypot(p.x - cx, p.y - cy);
}

/**
 * 선분 p0→p1 이 캡슐에 처음 닿는 t ∈ [0,1] 과 그 점. 닿지 않으면 null.
 * 직선 위를 움직이는 점과 볼록 집합(선분) 사이의 거리는 t 에 대해 볼록하므로
 * 삼분 탐색으로 최소점을 찾고, 최소 거리가 반지름 이하면 [0, t*] 에서 이분 탐색으로 첫 진입점을 찾는다.
 */
export function segmentCapsuleHit(p0, p1, pose, cap) {
  const { a, b } = capsuleSegment(pose, cap);
  const at = (t) => ({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
  const d = (t) => pointSegmentDist(at(t), a, b);
  const r = cap.radius;

  if (d(0) <= r) return { t: 0, point: at(0) };

  let lo = 0, hi = 1;
  for (let i = 0; i < 40; i++) {
    const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3;
    if (d(m1) < d(m2)) hi = m2; else lo = m1;
  }
  const tMin = (lo + hi) / 2;
  if (d(tMin) > r) return null;

  // 첫 진입: d(0) > r, d(tMin) ≤ r → 사이에 교차점 1개
  let x0 = 0, x1 = tMin;
  for (let i = 0; i < 40; i++) {
    const m = (x0 + x1) / 2;
    if (d(m) > r) x0 = m; else x1 = m;
  }
  return { t: x1, point: at(x1) };
}
