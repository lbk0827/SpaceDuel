// DOM HUD: 슬롯별 점수, 내 발사 게이지, 배너. 게임 규칙을 모른다.
import { SLOT_COLORS } from './sprites.js';

export function createHud(root) {
  const $ = (id) => root.querySelector(`#${id}`);
  const scores = $('scores'), gauge = $('gauge'), gaugeLabel = $('gaugeLabel');
  const banner = $('banner'), bannerTitle = $('bannerTitle'), bannerText = $('bannerText'), bannerBtns = $('bannerBtns');
  let lastScoreKey = '', lastGaugeKey = '';

  return {
    /** slots: [{ index, kind, score, alive, isLocal, label }] */
    setScores(slots) {
      const key = slots.map((s) => `${s.index}:${s.score}:${s.alive ? 1 : 0}:${s.label}`).join('|');
      if (key === lastScoreKey) return;
      lastScoreKey = key;
      scores.replaceChildren(...slots.map((s) => {
        const c = SLOT_COLORS[s.index % SLOT_COLORS.length];
        const el = document.createElement('span');
        el.className = 'pill' + (s.alive ? '' : ' dead');
        el.style.color = c.bolt;
        el.innerHTML = `<b>${s.label}</b> ${s.score}`;
        return el;
      }));
    },

    /** gate.state() 를 그대로 (내 슬롯) */
    setGauge(s) {
      if (!s) { gauge.replaceChildren(); gaugeLabel.textContent = ''; return; }
      if (s.mode === 'cooldown') {
        const pct = Math.round(Math.max(0, Math.min(1, s.ready)) * 100);
        const key = `c${pct}`;
        if (key === lastGaugeKey) return;
        lastGaugeKey = key;
        gauge.style.background = `conic-gradient(#3b9dff ${pct}%, #ffffff22 ${pct}%)`;
        gauge.className = 'ring' + (pct >= 100 ? ' ready' : '');
        gauge.replaceChildren();
        gaugeLabel.textContent = pct >= 100 ? 'READY' : '';
      } else {
        const full = Math.floor(s.energy), frac = s.energy - full;
        const key = `e${full}-${Math.round(frac * 20)}-${s.max}`;
        if (key === lastGaugeKey) return;
        lastGaugeKey = key;
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
      }
    },

    showBanner({ title, text = '', buttons = [], color }) {
      bannerTitle.textContent = title;
      bannerTitle.style.color = color || '';
      bannerText.innerHTML = text;
      bannerBtns.replaceChildren(...buttons.map(({ label, onClick, secondary }) => {
        const b = document.createElement('button');
        b.textContent = label;
        if (secondary) b.className = 'secondary';
        b.addEventListener('click', onClick);
        return b;
      }));
      banner.hidden = false;
    },
    hideBanner() { banner.hidden = true; },
    bannerVisible() { return !banner.hidden; },
  };
}
