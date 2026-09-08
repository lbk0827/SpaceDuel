// 아이템(순수 로직). 렌더·물리·네트워크를 모른다.
// 배달선이 n초마다 방을 가로지르며 아이템을 떨어뜨리고, 몸이 닿으면 획득한다.
//
// 목숨 모델: 우주복(suit) 이 첫 목숨이다. 맞으면 우주복이 깨져 빤스 상태가 되고, 그 상태에서 또 맞으면 죽는다.
// 배리어(아이템) 는 우주복 바깥의 추가 방어막(최대 3겹). 아머(아이템) 는 빤스 상태의 우주복을 복구한다 — 둘은 다른 아이템.
// 피격 순서: 배리어 → 우주복 → 사망.

export const ITEM_RADIUS = 0.4;

export const ITEM_DEFS = {
  barrier:   { label: '배리어',      short: 'BARRIER', color: '#7dd3fc', max: 3 },
  armor:     { label: '아머',        short: 'ARMOR',   color: '#f8fafc' },
  weaponSpd: { label: '레이저 속도',  short: 'SPD',     color: '#fbbf24', max: 3 },
  magazine:  { label: '탄창',        short: 'MAG',     color: '#a3e635', max: 3 },
};
export const ITEM_KINDS = Object.keys(ITEM_DEFS);

/** 슬롯별 상태. 라운드마다 초기화한다 */
export const emptyMods = () => ({ suit: true, barrier: 0, weaponSpd: 0, magazine: 0 });

/** 아이템 1개 획득. mods 를 변이하지 않고 새 객체를 돌려준다 */
export function applyItem(mods, kind) {
  const next = { ...emptyMods(), ...mods };
  if (kind === 'armor') {
    next.suit = true;                      // 빤스 → 우주복 복구 (이미 입었으면 변화 없음)
    return next;
  }
  const def = ITEM_DEFS[kind];
  if (!def) return next;
  next[kind] = Math.min(def.max ?? 99, (next[kind] ?? 0) + 1);
  return next;
}

/**
 * 피격 1회 처리. 배리어가 있으면 배리어가, 없고 우주복이 있으면 우주복이 깨진다. 둘 다 없으면 죽는다.
 * @returns { died, absorbedBy: 'barrier'|'suit'|null, mods }
 */
export function takeHit(mods) {
  const m = { ...emptyMods(), ...mods };
  if (m.barrier > 0) return { died: false, absorbedBy: 'barrier', mods: { ...m, barrier: m.barrier - 1 } };
  if (m.suit) return { died: false, absorbedBy: 'suit', mods: { ...m, suit: false } };
  return { died: true, absorbedBy: null, mods: m };
}

/** 효과가 반영된 실제 수치. base = { laserSpeed, fireMode, energyMax } */
export function effectiveStats(mods, base, tuning = {}) {
  const spdStep = tuning.itemSpdStep ?? 0.35;          // 한 개당 +35%
  const speed = base.laserSpeed * (1 + spdStep * (mods?.weaponSpd ?? 0));
  const mag = mods?.magazine ?? 0;
  return {
    laserSpeed: speed,
    // 탄창을 먹으면 쿨다운 대신 에너지(연사) 모드가 된다
    fireMode: mag > 0 ? 'energy' : base.fireMode,
    energyMax: mag > 0 ? Math.min(4, 1 + mag) : base.energyMax,
    barrier: mods?.barrier ?? 0,
    suit: mods?.suit ?? true,
  };
}

// ---------- 배달선 ----------

/**
 * 배달선 한 대를 만든다. 방 위쪽을 가로지르며 drops 개를 같은 간격으로 떨어뜨린다.
 * @returns { x, y, dir, speed, dropXs }
 */
export function spawnShip(arena, tuning, rnd = Math.random) {
  const dir = rnd() < 0.5 ? 1 : -1;
  const margin = 1.2;
  const y = arena.halfH * (0.35 + rnd() * 0.5);        // 위쪽 절반
  const speed = tuning.itemShipSpeed ?? 6;
  const drops = Math.max(1, Math.round(tuning.itemsPerPass ?? 2));
  return {
    x: dir > 0 ? -arena.halfW - margin : arena.halfW + margin,
    y, dir, speed,
    // 투하 지점 = 방을 drops+1 등분한 경계들 (진행 방향 순)
    dropXs: Array.from({ length: drops }, (_, i) => {
      const t = (i + 1) / (drops + 1);
      const from = dir > 0 ? -arena.halfW : arena.halfW;
      const to = dir > 0 ? arena.halfW : -arena.halfW;
      return from + (to - from) * t;
    }),
  };
}

/** 배달선 1스텝. 투하 지점을 지났으면 drops 에 좌표를 담아 돌려준다 */
export function stepShip(ship, dt, arena) {
  if (!ship) return { ship: null, drops: [], done: true };
  const x = ship.x + ship.dir * ship.speed * dt;
  const drops = [];
  const remain = [];
  for (const dx of ship.dropXs) {
    const passed = ship.dir > 0 ? x >= dx : x <= dx;
    if (passed) drops.push({ x: dx, y: ship.y });
    else remain.push(dx);
  }
  const margin = 1.5;
  const done = ship.dir > 0 ? x > arena.halfW + margin : x < -arena.halfW - margin;
  return { ship: done ? null : { ...ship, x, dropXs: remain }, drops, done };
}

// ---------- 아이템 필드 ----------

/** 아이템 1스텝: 수명 감소, 만료 제거 */
export function stepItems(items, dt, lifetime) {
  const alive = [];
  for (const it of items) {
    const age = it.age + dt;
    if (lifetime > 0 && age >= lifetime) continue;
    alive.push({ ...it, age });
  }
  return alive;
}

/**
 * 몸이 닿은 아이템을 찾는다. bodies = [{ id, x, y, radius }]
 * 한 아이템은 한 명만 먹는다(가장 가까운 쪽).
 */
export function pickups(items, bodies) {
  const out = [];
  for (const it of items) {
    let best = null;
    for (const b of bodies) {
      const d = Math.hypot(b.x - it.x, b.y - it.y);
      if (d <= (b.radius ?? 0.45) + ITEM_RADIUS && (!best || d < best.d)) best = { d, id: b.id };
    }
    if (best) out.push({ itemId: it.id, slotId: best.id, kind: it.kind });
  }
  return out;
}

/** 다음 아이템 종류 — 순환이라 한 종류만 몰리지 않는다 (4종) */
export function nextKind(counter) {
  return ITEM_KINDS[counter % ITEM_KINDS.length];
}
