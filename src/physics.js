// Rapier2D 래핑. 닫힌 방(벽 4개) + 캡슐 몸 2개. 탄은 엔진 밖(laser.js).
// 좌표: 원점 = 방 중심, y 위쪽 (Rapier 도 y 위쪽이라 변환 없음).

export function createPhysics(RAPIER, tuning, WORLD) {
  const world = new RAPIER.World({ x: 0, y: tuning.gravity });
  world.timestep = WORLD.physicsStep;

  const hw = WORLD.width / 2, hh = WORLD.height / 2, t = WORLD.wallThickness;
  const wallColliders = [];
  function wall(hx, hy, x, y) {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
    const col = world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy).setFriction(tuning.friction).setRestitution(tuning.restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body,
    );
    wallColliders.push(col);
  }
  wall(hw + t, t / 2, 0, -hh - t / 2);  // 바닥
  wall(hw + t, t / 2, 0, hh + t / 2);   // 천장
  wall(t / 2, hh + t, -hw - t / 2, 0);  // 왼벽
  wall(t / 2, hh + t, hw + t / 2, 0);   // 오른벽

  const bodies = new Map(); // id → { body, collider, facing }

  let shape = WORLD.ball;
  function spawnBody(id, x, y, facing) {
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic().setTranslation(x, y).setRotation(0)
        .setLinearDamping(tuning.linearDamping).setAngularDamping(tuning.angularDamping).setCcdEnabled(true),
    );
    const { halfHeight, radius } = shape;
    const desc = halfHeight > 0 ? RAPIER.ColliderDesc.capsule(halfHeight, radius) : RAPIER.ColliderDesc.ball(radius);
    const col = world.createCollider(
      desc.setDensity(1 / (Math.PI * radius * radius + 4 * halfHeight * radius))
        .setFriction(tuning.friction).setRestitution(tuning.restitution)
        .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
      body,
    );
    bodies.set(id, { body, collider: col, facing });
  }

  return {
    /** 라운드 시작: 기존 몸 제거 후 재배치 */
    reset(spawns, bodyShape = WORLD.ball) {
      shape = bodyShape;
      for (const rec of bodies.values()) world.removeRigidBody(rec.body);
      bodies.clear();
      for (const [id, s] of Object.entries(spawns)) spawnBody(id, s.x, s.y, s.facing);
    },

    /** 몸 상태 스냅샷 { pose:{x,y,angle}, vel:{x,y}, angvel, facing } */
    get(id) {
      const rec = bodies.get(id);
      if (!rec) return null;
      const p = rec.body.translation(), v = rec.body.linvel();
      return { pose: { x: p.x, y: p.y, angle: rec.body.rotation() }, vel: { x: v.x, y: v.y }, angvel: rec.body.angvel(), facing: rec.facing };
    },

    /** 총구 위치에 총구 반대 방향 임펄스 — 밀림+회전은 엔진이 계산 */
    applyRecoil(id, muzzlePos, dir, impulse) {
      const rec = bodies.get(id);
      if (!rec) return;
      rec.body.applyImpulseAtPoint({ x: -dir.x * impulse, y: -dir.y * impulse }, muzzlePos, true);
    },

    /** 고정 스텝 1회. 자립 토크는 옵션(기본 0). 감쇠·중력은 매 스텝 tuning 에서 다시 읽는다 */
    step() {
      world.gravity = { x: 0, y: tuning.gravity };
      // 반발·마찰은 슬라이더 즉시 반영 (벽 + 몸)
      for (const c of wallColliders) { c.setRestitution(tuning.restitution); c.setFriction(tuning.friction); }
      for (const rec of bodies.values()) {
        rec.collider.setRestitution(tuning.restitution); rec.collider.setFriction(tuning.friction);
        rec.body.setLinearDamping(tuning.linearDamping);
        rec.body.setAngularDamping(tuning.angularDamping);
        if (tuning.uprightTorque > 0) {
          const a = rec.body.rotation();
          const wrapped = Math.atan2(Math.sin(a), Math.cos(a));
          rec.body.applyTorqueImpulse(-wrapped * tuning.uprightTorque * WORLD.physicsStep, true);
        }
      }
      world.step();
    },
  };
}
