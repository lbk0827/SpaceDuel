// 파라미터 단일 출처. 순수 로직 모듈은 이 파일을 import 하지 않고 값을 인자로 받는다.

export const WORLD = {
  wallThickness: 0.5,   // 방 크기는 인원수에 따라 arena.js 가 정한다
  capsule: { halfHeight: 0.35, radius: 0.25 }, // 총 높이 1.2 = 2×(0.35+0.25), 폭 0.5 (bodyShape=capsule 일 때)
  ball: { halfHeight: 0, radius: 0.45 },       // 다리 없는 둥근 몸 (기본). 착지해도 서지 않고 굴러 임의 방향을 본다
  boltLength: 1.0,
  boltTrail: 0.15,
  physicsStep: 1 / 120,
};

export const meta = [
  { key: 'gravity',           label: '중력',                  min: -30, max: 0,    step: 0.5 },
  { key: 'bodyShape',         label: '몸 형태(다음 라운드)',     type: 'select', options: ['ball', 'capsule'] },
  { key: 'recoilImpulse',     label: '반동 임펄스',            min: 1,   max: 15,   step: 0.5 },
  { key: 'gunOffsetY',        label: '총구 높이(지렛대)',       min: 0,   max: 0.6,  step: 0.05 },
  { key: 'gunOffsetX',        label: '총구 앞 거리',           min: 0.2, max: 0.8,  step: 0.05 },
  { key: 'angularDamping',    label: '회전 감쇠',              min: 0,   max: 5,    step: 0.1 },
  { key: 'linearDamping',     label: '이동 감쇠',              min: 0,   max: 2,    step: 0.05 },
  { key: 'friction',          label: '마찰',                  min: 0,   max: 1.5,  step: 0.05 },
  { key: 'restitution',       label: '반발',                  min: 0,   max: 1,    step: 0.05 },
  { key: 'uprightTorque',     label: '자립 토크(0=끔)',        min: 0,   max: 10,   step: 0.5 },
  { key: 'laserSpeed',        label: '레이저 속도',            min: 10,  max: 60,   step: 1 },
  { key: 'fireMode',          label: '발사 제약 모드',          type: 'select', options: ['cooldown', 'energy'] },
  { key: 'cooldown',          label: '쿨다운(s)',              min: 0.1, max: 2,    step: 0.05 },
  { key: 'energyMax',         label: '에너지 최대(발)',         min: 1,   max: 6,    step: 1 },
  { key: 'energyRegen',       label: '에너지 충전(s/발)',       min: 0.2, max: 4,    step: 0.1 },
  { key: 'slowmoScale',       label: '슬로모 배율',            min: 0.05, max: 1,   step: 0.05 },
  { key: 'slowmoLookahead',   label: '슬로모 예측(s)',          min: 0,   max: 1,    step: 0.05 },
  { key: 'aiToleranceDeg',    label: 'AI 허용각(°)',           min: 1,   max: 30,   step: 1 },
  { key: 'aiReaction',        label: 'AI 반응 지연(s)',         min: 0,   max: 1,    step: 0.05 },
  { key: 'aiRepositionAfter', label: 'AI 재배치 사격(s)',       min: 0.5, max: 6,    step: 0.1 },
  { key: 'aiDodgeLookahead',  label: 'AI 회피 예측(s, 0=끔)',    min: 0,   max: 1,    step: 0.05 },
  { key: 'botCount',          label: '봇 수(혼자 하기)',        min: 0,   max: 3,    step: 1 },
  { key: 'arenaWidthPerPlayer', label: '3인 이상 1명당 방 확대(m)', min: 0, max: 8,  step: 0.5 },
  { key: 'scaleWithArena',    label: '방 크기에 속도 비례',      type: 'bool' },
  { key: 'roundsToWin',       label: '선승',                  min: 1,   max: 5,    step: 1 },
  { key: 'spawnLock',         label: '시작 발사 잠금(s)',       min: 0,   max: 3,    step: 0.1 },
  { key: 'aimGuide',          label: '총구 방향 가이드 표시',    type: 'bool' },
];

export const defaults = Object.freeze({
  gravity: 0,         // 유저 확정: 완전 무중력 (닫힌 방 + 반발 0.6 이라 떠다니며 튕긴다)
  bodyShape: 'ball',
  recoilImpulse: 6,
  gunOffsetY: 0.30,
  gunOffsetX: 0.45,
  angularDamping: 0.8,
  linearDamping: 0.1,
  friction: 0.6,
  restitution: 0.6,   // 벽·바닥에서 튕김 (유저 요청)
  uprightTorque: 0,
  laserSpeed: 13,     // 유저 확정: 느린 탄 — 궤적이 잘 보이고 피할 여지가 생긴다
  fireMode: 'cooldown',
  cooldown: 0.5,
  energyMax: 3,
  energyRegen: 1.2,
  slowmoScale: 0.25,
  slowmoLookahead: 0.25,
  aiToleranceDeg: 3,       // 명중 예측이 주 판정, 허용각은 보조
  aiReaction: 0.05,
  aiRepositionAfter: 1.2,
  aiDodgeLookahead: 0.45,  // 이 시간 안에 맞을 탄이면 회피 사격 검토
  botCount: 3,
  arenaWidthPerPlayer: 3,
  scaleWithArena: true,
  roundsToWin: 3,
  spawnLock: 0,     // 태어나면서 바로 쏠 수 있음 (유저 결정)
  aimGuide: true,
});

const SAVE_KEY = 'recoil-duel.tuning';

/** 사용자가 저장한 기본값(localStorage) — 있으면 공장 기본값 위에 덮어쓴다 */
export function loadSavedTuning() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const out = {};
    for (const k of Object.keys(defaults)) if (k in obj && typeof obj[k] === typeof defaults[k]) out[k] = obj[k];
    return out;
  } catch { return null; }
}
export function saveTuningAsDefault(t = tuning) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(t)); return true; } catch { return false; }
}
export function clearSavedTuning() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* 무시 */ }
}

export const tuning = { ...defaults, ...(loadSavedTuning() ?? {}) };
/** 현재 몸 형태의 콜라이더 치수 (geom 캡슐 규약: halfHeight 0 = 원) */
export const bodyShapeOf = (t = tuning) => (t.bodyShape === 'capsule' ? WORLD.capsule : WORLD.ball);
/** 공장 기본값으로 (저장된 사용자 기본값은 지우지 않음) */
export function resetTuning() { Object.assign(tuning, defaults); }
