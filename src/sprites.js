// 우주인 SVG 스프라이트. 로컬 단위: 1m = 100px. 몸 중심 (0,0) 이 캡슐 중심, 위가 +y 가 되도록 renderer 가 뒤집어 그린다.
// 그림은 오른쪽(+x)을 바라보는 기준으로 그리고, facing = -1 이면 renderer 가 좌우 반전한다.
// 총은 어깨(+0.30) 높이에서 앞(+x)으로 뻗어 있고, 총구 끝이 로컬 (gunOffsetX, gunOffsetY) 에 온다.

export function astronautSvg({ suit, accent, visor = '#1b2a4a', legs = true, suited = true }) {
  if (!legs) return suited ? roundAstronautSvg({ suit, accent, visor }) : roundUnderwearSvg({ accent, visor });
  if (!suited) return underwearSvg({ accent, visor });
  // 캡슐 1.2 × 0.5 m 안에 맞춘 비율. SVG 좌표는 y 아래 방향 → 캔버스에서 flip 하지 않고 그리므로 여기선 "위 = 음수 y".
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -70 120 140" width="120" height="140">
  <!-- 산소통 (뒤) -->
  <rect x="-34" y="-26" width="16" height="44" rx="6" fill="${accent}" stroke="#0008" stroke-width="2"/>
  <!-- 다리 -->
  <rect x="-18" y="24" width="14" height="36" rx="6" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <rect x="4" y="24" width="14" height="36" rx="6" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <rect x="-20" y="52" width="18" height="10" rx="4" fill="#333"/>
  <rect x="2" y="52" width="18" height="10" rx="4" fill="#333"/>
  <!-- 몸통 -->
  <rect x="-22" y="-20" width="44" height="50" rx="12" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <rect x="-10" y="-8" width="20" height="14" rx="3" fill="${accent}" opacity=".9"/>
  <!-- 헬멧 -->
  <circle cx="0" cy="-42" r="24" fill="#f3f5fa" stroke="#0008" stroke-width="2"/>
  <path d="M-12 -52 A 18 18 0 0 1 20 -40 L 20 -30 A 18 18 0 0 1 -12 -30 Z" fill="${visor}"/>
  <path d="M-4 -56 A 14 10 0 0 1 12 -50" stroke="#fff8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 뒤팔 -->
  <rect x="-30" y="-14" width="14" height="30" rx="6" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <!-- 총 (어깨 높이 y=-30 에서 앞으로) -->
  <rect x="6" y="-36" width="40" height="12" rx="3" fill="#2a2f3a" stroke="#000a" stroke-width="2"/>
  <rect x="34" y="-40" width="14" height="6" rx="2" fill="${accent}"/>
  <rect x="10" y="-24" width="8" height="14" rx="2" fill="#2a2f3a"/>
  <!-- 앞팔 (총을 쥠) -->
  <rect x="14" y="-30" width="14" height="22" rx="6" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <circle cx="21" cy="-9" r="6" fill="${accent}" stroke="#0008" stroke-width="2"/>
</svg>`;
}

/** 다리 없는 둥근 우주인 — 지름 0.9m 원(반지름 45px) 안에 헬멧+몸통. 총은 어깨(y=-30)에서 앞으로, 총구 끝 x=48 */
export function roundAstronautSvg({ suit, accent, visor = '#1b2a4a' }) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120" width="120" height="120">
  <!-- 산소통 (뒤) -->
  <rect x="-44" y="-14" width="16" height="40" rx="7" fill="${accent}" stroke="#0008" stroke-width="2"/>
  <!-- 몸통: 둥근 몸 -->
  <ellipse cx="0" cy="12" rx="30" ry="30" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <rect x="-10" y="6" width="20" height="14" rx="3" fill="${accent}" opacity=".9"/>
  <circle cx="-14" cy="34" r="8" fill="#333"/><circle cx="14" cy="34" r="8" fill="#333"/>
  <!-- 헬멧 -->
  <circle cx="0" cy="-22" r="23" fill="#f3f5fa" stroke="#0008" stroke-width="2"/>
  <path d="M-11 -32 A 17 17 0 0 1 19 -20 L 19 -11 A 17 17 0 0 1 -11 -11 Z" fill="${visor}"/>
  <path d="M-3 -36 A 13 9 0 0 1 12 -30" stroke="#fff8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 뒤팔 -->
  <rect x="-40" y="-8" width="14" height="28" rx="6" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <!-- 총 (어깨 높이 y=-30) -->
  <rect x="6" y="-36" width="40" height="12" rx="3" fill="#2a2f3a" stroke="#000a" stroke-width="2"/>
  <rect x="34" y="-40" width="14" height="6" rx="2" fill="${accent}"/>
  <rect x="10" y="-24" width="8" height="12" rx="2" fill="#2a2f3a"/>
  <!-- 앞팔 -->
  <rect x="16" y="-30" width="14" height="24" rx="6" fill="${suit}" stroke="#0008" stroke-width="2"/>
  <circle cx="23" cy="-6" r="6" fill="${accent}" stroke="#0008" stroke-width="2"/>
</svg>`;
}

/** 우주복이 깨진 상태(다리 버전): 헬멧은 쓰고, 맨몸에 빤스만. 총은 그대로 든다 */
export function underwearSvg({ accent, visor = '#1b2a4a' }) {
  const skin = '#f6c9a8', skinDark = '#d9a37f';
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -70 120 140" width="120" height="140">
  <!-- 다리(맨살) -->
  <rect x="-18" y="24" width="14" height="36" rx="6" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <rect x="4" y="24" width="14" height="36" rx="6" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <ellipse cx="-11" cy="60" rx="9" ry="4" fill="${skinDark}"/><ellipse cx="11" cy="60" rx="9" ry="4" fill="${skinDark}"/>
  <!-- 몸통(맨살) -->
  <rect x="-20" y="-18" width="40" height="46" rx="12" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <!-- 빤스 -->
  <rect x="-21" y="14" width="42" height="16" rx="5" fill="${accent}" stroke="#0008" stroke-width="2"/>
  <circle cx="-10" cy="22" r="2.5" fill="#fff"/><circle cx="0" cy="24" r="2.5" fill="#fff"/><circle cx="10" cy="21" r="2.5" fill="#fff"/>
  <!-- 헬멧 (그대로) -->
  <circle cx="0" cy="-42" r="24" fill="#f3f5fa" stroke="#0008" stroke-width="2"/>
  <path d="M-12 -52 A 18 18 0 0 1 20 -40 L 20 -30 A 18 18 0 0 1 -12 -30 Z" fill="${visor}"/>
  <path d="M-4 -56 A 14 10 0 0 1 12 -50" stroke="#fff8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 뒤팔(맨살) -->
  <rect x="-28" y="-12" width="12" height="28" rx="6" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <!-- 총 -->
  <rect x="6" y="-36" width="40" height="12" rx="3" fill="#2a2f3a" stroke="#000a" stroke-width="2"/>
  <rect x="34" y="-40" width="14" height="6" rx="2" fill="${accent}"/>
  <rect x="10" y="-24" width="8" height="14" rx="2" fill="#2a2f3a"/>
  <!-- 앞팔(맨살) -->
  <rect x="14" y="-30" width="12" height="22" rx="6" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <circle cx="20" cy="-9" r="6" fill="${skinDark}" stroke="#0006" stroke-width="2"/>
</svg>`;
}

/** 우주복이 깨진 상태(둥근 몸 버전) */
export function roundUnderwearSvg({ accent, visor = '#1b2a4a' }) {
  const skin = '#f6c9a8', skinDark = '#d9a37f';
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -60 120 120" width="120" height="120">
  <!-- 몸통(맨살) -->
  <ellipse cx="0" cy="12" rx="30" ry="30" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <!-- 빤스: 몸 아래쪽 띠 -->
  <path d="M-29 18 A 30 30 0 0 0 29 18 L 29 26 A 30 30 0 0 1 -29 26 Z" fill="${accent}" stroke="#0008" stroke-width="2"/>
  <circle cx="-12" cy="24" r="2.5" fill="#fff"/><circle cx="0" cy="27" r="2.5" fill="#fff"/><circle cx="12" cy="24" r="2.5" fill="#fff"/>
  <circle cx="-14" cy="38" r="7" fill="${skinDark}"/><circle cx="14" cy="38" r="7" fill="${skinDark}"/>
  <!-- 헬멧 -->
  <circle cx="0" cy="-22" r="23" fill="#f3f5fa" stroke="#0008" stroke-width="2"/>
  <path d="M-11 -32 A 17 17 0 0 1 19 -20 L 19 -11 A 17 17 0 0 1 -11 -11 Z" fill="${visor}"/>
  <path d="M-3 -36 A 13 9 0 0 1 12 -30" stroke="#fff8" stroke-width="3" fill="none" stroke-linecap="round"/>
  <!-- 뒤팔(맨살) -->
  <rect x="-38" y="-6" width="12" height="26" rx="6" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <!-- 총 -->
  <rect x="6" y="-36" width="40" height="12" rx="3" fill="#2a2f3a" stroke="#000a" stroke-width="2"/>
  <rect x="34" y="-40" width="14" height="6" rx="2" fill="${accent}"/>
  <rect x="10" y="-24" width="8" height="12" rx="2" fill="#2a2f3a"/>
  <!-- 앞팔(맨살) -->
  <rect x="16" y="-30" width="12" height="24" rx="6" fill="${skin}" stroke="#0006" stroke-width="2"/>
  <circle cx="22" cy="-6" r="6" fill="${skinDark}" stroke="#0006" stroke-width="2"/>
</svg>`;
}

/** 아이템 아이콘 (64×64). 보자마자 뭔지 알 수 있게 그림으로 */
export function itemIconSvg(kind) {
  const wrap = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${inner}</svg>`;
  switch (kind) {
    case 'barrier': // 육각 방패 + 안쪽 호
      return wrap(`
  <path d="M32 6 L54 16 L54 34 Q54 50 32 58 Q10 50 10 34 L10 16 Z" fill="#38bdf8" stroke="#0c4a6e" stroke-width="3" stroke-linejoin="round"/>
  <path d="M32 14 L46 21 L46 34 Q46 44 32 50 Q18 44 18 34 L18 21 Z" fill="#7dd3fc" opacity=".9"/>
  <path d="M24 30 A 9 9 0 0 1 40 30" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    case 'armor': // 우주복 상체 + 헬멧
      return wrap(`
  <circle cx="32" cy="18" r="11" fill="#f3f5fa" stroke="#1e293b" stroke-width="3"/>
  <path d="M26 13 A 8 8 0 0 1 40 17 L 40 22 A 8 8 0 0 1 26 22 Z" fill="#1b2a4a"/>
  <path d="M14 58 L14 38 Q14 30 22 29 L42 29 Q50 30 50 38 L50 58 Z" fill="#f8fafc" stroke="#1e293b" stroke-width="3" stroke-linejoin="round"/>
  <rect x="26" y="38" width="12" height="9" rx="2" fill="#3b82f6"/>
  <rect x="6" y="32" width="8" height="18" rx="4" fill="#f8fafc" stroke="#1e293b" stroke-width="3"/>
  <rect x="50" y="32" width="8" height="18" rx="4" fill="#f8fafc" stroke="#1e293b" stroke-width="3"/>`);
    case 'weaponSpd': // 레이저 볼트 + 앞으로 쏘는 쉐브론
      return wrap(`
  <rect x="6" y="27" width="30" height="10" rx="5" fill="#fbbf24" stroke="#78350f" stroke-width="3"/>
  <rect x="10" y="30" width="18" height="4" rx="2" fill="#fff7cc"/>
  <path d="M40 20 L50 32 L40 44" stroke="#fbbf24" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M48 20 L58 32 L48 44" stroke="#f59e0b" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    case 'magazine': // 탄창 + 탄두 3개
      return wrap(`
  <rect x="16" y="26" width="32" height="30" rx="5" fill="#65a30d" stroke="#1a2e05" stroke-width="3"/>
  <rect x="20" y="30" width="24" height="6" rx="2" fill="#a3e635"/>
  <g fill="#fbbf24" stroke="#78350f" stroke-width="2">
    <path d="M20 26 L20 14 Q24 6 28 14 L28 26 Z"/>
    <path d="M28 26 L28 14 Q32 6 36 14 L36 26 Z"/>
    <path d="M36 26 L36 14 Q40 6 44 14 L44 26 Z"/>
  </g>`);
    default:
      return wrap('<circle cx="32" cy="32" r="24" fill="#fff"/>');
  }
}

const iconCache = new Map();
export function itemIconFor(kind) {
  if (!iconCache.has(kind)) iconCache.set(kind, loadSprite(itemIconSvg(kind)));
  return iconCache.get(kind);
}

export function loadSprite(svg) {
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.trim());
  return img;
}

/** 슬롯 인덱스별 색: 0 파랑(방장) · 1 빨강 · 2 노랑 · 3 초록 */
export const SLOT_COLORS = [
  { suit: '#dfe7ff', accent: '#3b82f6', bolt: '#3b9dff', name: '파랑' },
  { suit: '#ffe3e3', accent: '#ef4444', bolt: '#ff4b4b', name: '빨강' },
  { suit: '#fff6d9', accent: '#eab308', bolt: '#ffd43b', name: '노랑' },
  { suit: '#dcffe4', accent: '#22c55e', bolt: '#4ade80', name: '초록' },
];

const spriteCache = new Map();
/** 슬롯 인덱스 + 몸 형태 + 우주복 여부별 스프라이트 (캐시) */
export function spriteFor(index, legs, suited = true) {
  const key = `${index}:${legs ? 'legs' : 'ball'}:${suited ? 'suit' : 'bare'}`;
  if (!spriteCache.has(key)) {
    const c = SLOT_COLORS[index % SLOT_COLORS.length];
    spriteCache.set(key, loadSprite(astronautSvg({ suit: c.suit, accent: c.accent, legs, suited })));
  }
  return spriteCache.get(key);
}
