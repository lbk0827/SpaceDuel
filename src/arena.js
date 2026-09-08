// 경기장 크기·스폰 배치(순수). 인원이 늘면 방을 16:9 비율로 넓힌다 —
// 카메라가 방 폭에 맞춰 스케일을 잡으므로 방이 커지면 캐릭터가 자동으로 작게 보인다.

const BASE_WIDTH = 16;
const ASPECT = 9 / 16;
const MARGIN = 1;        // 벽에서 띄우는 여유(m)

export function arenaFor(playerCount, tuning) {
  const extra = Math.max(0, (playerCount || 1) - 2) * (tuning.arenaWidthPerPlayer ?? 3);
  const width = BASE_WIDTH + extra;
  const height = width * ASPECT;
  return {
    width, height,
    halfW: width / 2, halfH: height / 2,
    // 방이 커지면 탄이 가로지르는 시간이 길어지므로 속도·반동을 같은 비율로 키운다
    speedScale: tuning.scaleWithArena === false ? 1 : width / BASE_WIDTH,
  };
}

// 네 모서리. 2인이면 대각선(0, 1), 3인은 +우상, 4인은 +좌하.
const CORNERS = [
  { sx: -1, sy: 1 },   // 좌상
  { sx: 1, sy: -1 },   // 우하
  { sx: 1, sy: 1 },    // 우상
  { sx: -1, sy: -1 },  // 좌하
];

export function spawnsFor(slotIds, arena) {
  const out = {};
  slotIds.forEach((id, i) => {
    const c = CORNERS[i % CORNERS.length];
    const x = c.sx * (arena.halfW - MARGIN);
    const y = c.sy * (arena.halfH - MARGIN);
    out[id] = { x, y, facing: x < 0 ? 1 : -1 }; // 항상 방 안쪽(상대 쪽)을 본다
  });
  return out;
}
