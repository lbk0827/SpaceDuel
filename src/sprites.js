// 우주인 SVG 스프라이트. 로컬 단위: 1m = 100px. 몸 중심 (0,0) 이 캡슐 중심, 위가 +y 가 되도록 renderer 가 뒤집어 그린다.
// 그림은 오른쪽(+x)을 바라보는 기준으로 그리고, facing = -1 이면 renderer 가 좌우 반전한다.
// 총은 어깨(+0.30) 높이에서 앞(+x)으로 뻗어 있고, 총구 끝이 로컬 (gunOffsetX, gunOffsetY) 에 온다.

export function astronautSvg({ suit, accent, visor = '#1b2a4a', legs = true }) {
  if (!legs) return roundAstronautSvg({ suit, accent, visor });
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
/** 슬롯 인덱스 + 몸 형태별 스프라이트 (캐시) */
export function spriteFor(index, legs) {
  const key = `${index}:${legs ? 'legs' : 'ball'}`;
  if (!spriteCache.has(key)) {
    const c = SLOT_COLORS[index % SLOT_COLORS.length];
    spriteCache.set(key, loadSprite(astronautSvg({ suit: c.suit, accent: c.accent, legs })));
  }
  return spriteCache.get(key);
}
