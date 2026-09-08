// Rapier2D 래핑. 닫힌 방(벽 4개) + 슬롯별 몸. 탄은 엔진 밖(laser.js).
// 좌표: 원점 = 방 중심, y 위쪽 (Rapier 도 y 위쪽이라 변환 없음).
// 방 크기가 인원수에 따라 바뀌므로 월드는 reset() 에서 매번 새로 만든다(잔여 상태도 함께 정리된다).

export function createPhysics(RAPIER, tuning, WORLD) {
  let world = null;
  let events = null;
  let arena = null;
  let shape = WORLD.ball;

  const byCollider = new Map();   // collider handle → { kind, id }
  const bodies = new Map();       // slot id → { body, collider, facing }
  const wallColliders = [];

  function buildWorld() {
    world = new RAPIER.World({ x: 0, y: tuning.gravity });
    world.timestep = WORLD.physicsStep;
    events = new RAPIER.EventQueue(true);
    byCollider.clear();
    bodies.clear();
    wallColliders.length = 0;

    const t = WORLD.wallThickness;
    const { halfW, halfH } = arena;
    const wall = (hx, hy, x, y) => {
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y));
      const col = world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy).setFriction(tuning.friction).setRestitution(tuning.restitution)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Max),
        body,
      );
      byCollider.set(col.handle, { kind: 'wall' });
      wallColliders.push(col);
    };
    wall(halfW + t, t / 2, 0, -halfH - t / 2);  // 바닥
    wall(halfW + t, t / 2, 0, halfH + t / 2);   // 천장
    wall(t / 2, halfH + t, -halfW - t / 2, 0);  // 왼벽
    wall(t / 2, halfH + t, halfW + t / 2, 0);   // 오른벽
  }

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
    byCollider.set(col.handle, { kind: 'body', id });
    bodies.set(id, { body, collider: col, facing });
  }

  return {
    /** 라운드 시작: 방 크기·몸 형태를 받아 월드를 새로 만들고 배치 */
    reset(spawns, bodyShape, nextArena) {
      shape = bodyShape ?? WORLD.ball;
      arena = nextArena;
      buildWorld();
      for (const [id, s] of Object.entries(spawns)) spawnBody(id, s.x, s.y, s.facing);
    },

    /** 사망 등으로 몸을 치운다 */
    removeBody(id) {
      const rec = bodies.get(id);
      if (!rec) return;
      for (let i = 0; i < rec.body.numColliders(); i++) byCollider.delete(rec.body.collider(i).handle);
      world.removeRigidBody(rec.body);
      bodies.delete(id);
    },

    has(id) { return bodies.has(id); },

    /** { pose:{x,y,angle}, vel:{x,y}, angvel, facing } */
    get(id) {
      const rec = bodies.get(id);
      if (!rec) return null;
      const p = rec.body.translation(), v = rec.body.linvel();
      return { pose: { x: p.x, y: p.y, angle: rec.body.rotation() }, vel: { x: v.x, y: v.y }, angvel: rec.body.angvel(), facing: rec.facing };
    },

    /** 네트워크 자세 보정 — k=1 이면 스냅, 작으면 부드럽게 끌어당김 */
    correct(id, target, k = 1) {
      const rec = bodies.get(id);
      if (!rec) return;
      const p = rec.body.translation(), v = rec.body.linvel();
      const lerp = (a, b) => a + (b - a) * k;
      rec.body.setTranslation({ x: lerp(p.x, target.x), y: lerp(p.y, target.y) }, true);
      rec.body.setRotation(lerp(rec.body.rotation(), target.angle), true);
      rec.body.setLinvel({ x: lerp(v.x, target.vx), y: lerp(v.y, target.vy) }, true);
      rec.body.setAngvel(lerp(rec.body.angvel(), target.angvel), true);
    },

    /** 총구 위치에 총구 반대 방향 임펄스 — 밀림+회전은 엔진이 계산 */
    applyRecoil(id, muzzlePos, dir, impulse) {
      const rec = bodies.get(id);
      if (!rec) return;
      rec.body.applyImpulseAtPoint({ x: -dir.x * impulse, y: -dir.y * impulse }, muzzlePos, true);
    },

    /** 고정 스텝 1회. 중력·감쇠·마찰·반발은 매 스텝 tuning 에서 다시 읽어 슬라이더가 즉시 듣는다 */
    step() {
      if (!world) return;
      world.gravity = { x: 0, y: tuning.gravity };
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
      world.step(events);
    },
  };
}
