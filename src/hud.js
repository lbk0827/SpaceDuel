// DOM HUD: 점수, 발사 게이지(쿨 링 / 에너지 칸), 배너.

export function createHud(root) {
  const $ = (id) => root.querySelector(`#${id}`);
  const scoreP = $('scoreP'), scoreA = $('scoreA'), gauge = $('gauge'), gaugeLabel = $('gaugeLabel');
  const banner = $('banner'), bannerTitle = $('bannerTitle'), bannerText = $('bannerText'), bannerBtns = $('bannerBtns');
  let lastKey = '';

  return {
    setScore(p, a) { scoreP.textContent = String(p); scoreA.textContent = String(a); },

    /** gate.state() 를 그대로 */
    setGauge(s) {
      if (s.mode === 'cooldown') {
        const pct = Math.round(Math.max(0, Math.min(1, s.ready)) * 100);
        const key = `c${pct}`;
        if (key !== lastKey) {
          gauge.style.background = `conic-gradient(#3b9dff ${pct}%, #ffffff22 ${pct}%)`;
          gauge.className = 'ring' + (pct >= 100 ? ' ready' : '');
          gauge.replaceChildren();
          gaugeLabel.textContent = pct >= 100 ? 'READY' : '';
          lastKey = key;
        }
      } else {
        const full = Math.floor(s.energy), frac = s.energy - full;
        const key = `e${full}-${Math.round(frac * 20)}-${s.max}`;
        if (key !== lastKey) {
          gauge.className = 'pips';
          gauge.style.background = 'none';
          gauge.replaceChildren(...Array.from({ length: s.max }, (_, i) => {
            const d = document.createElement('span');
            d.className = 'pip';
            const fill = i < full ? 1 : i === full ? frac : 0;
            d.style.background = `linear-gradient(to top, #3b9dff ${fill * 100}%, #ffffff22 ${fill * 100}%)`;
            return d;
          }));
          gaugeLabel.textContent = `${full}/${s.max}`;
          lastKey = key;
        }
      }
    },

    showBanner({ title, text = '', buttons = [] }) {
      bannerTitle.textContent = title; bannerText.textContent = text;
      bannerBtns.replaceChildren(...buttons.map(({ label, onClick }) => {
        const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', onClick); return b;
      }));
      banner.hidden = false;
    },
    hideBanner() { banner.hidden = true; },
  };
}
