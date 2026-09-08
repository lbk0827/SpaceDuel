// 튠 패널. meta 로 컨트롤을 만들고 tuning 을 즉시 갱신. 백틱 키 / ?dev=1 토글.
import { meta, tuning, defaults, resetTuning, saveTuningAsDefault, clearSavedTuning, loadSavedTuning } from './tuning.js';

export function createPanel(root) {
  function build() {
    root.replaceChildren();
    const title = document.createElement('div');
    title.innerHTML = '<b>튠 패널</b> <small>(` 키로 닫기)</small>';
    root.appendChild(title);

    for (const m of meta) {
      const label = document.createElement('label');
      const row = document.createElement('div'); row.className = 'row';
      const name = document.createElement('span'); name.textContent = m.label;
      const val = document.createElement('span');
      row.append(name, val); label.appendChild(row);

      if (m.type === 'bool') {
        const input = document.createElement('input'); input.type = 'checkbox'; input.checked = !!tuning[m.key];
        input.addEventListener('change', () => { tuning[m.key] = input.checked; });
        row.insertBefore(input, val);
      } else if (m.type === 'select') {
        const sel = document.createElement('select');
        for (const o of m.options) { const op = document.createElement('option'); op.value = o; op.textContent = o; sel.appendChild(op); }
        sel.value = tuning[m.key];
        sel.addEventListener('change', () => { tuning[m.key] = sel.value; });
        row.insertBefore(sel, val);
      } else {
        const input = document.createElement('input'); input.type = 'range';
        input.min = m.min; input.max = m.max; input.step = m.step; input.value = tuning[m.key];
        val.textContent = `${tuning[m.key]} (기본 ${defaults[m.key]})`;
        input.addEventListener('input', () => { tuning[m.key] = Number(input.value); val.textContent = `${tuning[m.key]} (기본 ${defaults[m.key]})`; });
        label.appendChild(input);
      }
      root.appendChild(label);
    }
    const saved = loadSavedTuning();
    const info = document.createElement('div');
    info.style.cssText = 'margin-top:10px;font-size:11px;opacity:.75';
    info.textContent = saved ? '● 이 브라우저에 저장된 사용자 기본값으로 시작합니다' : '○ 공장 기본값으로 시작합니다';
    root.appendChild(info);

    const mk = (label, onClick) => { const b = document.createElement('button'); b.textContent = label; b.addEventListener('click', onClick); root.appendChild(b); return b; };
    mk('현재 값을 기본값으로 저장', () => { saveTuningAsDefault(); build(); flash('저장됨 — 다음 실행부터 이 값으로 시작'); });
    mk('설정 JSON 복사', async () => {
      const json = JSON.stringify(tuning, null, 2);
      try { await navigator.clipboard.writeText(json); flash('클립보드에 복사됨'); }
      catch { window.prompt('복사해서 전달해 주세요', json); }
    });
    mk('공장 기본값으로', () => { clearSavedTuning(); resetTuning(); build(); flash('공장 기본값 복원(저장값 삭제)'); });
    const msg = document.createElement('div'); msg.id = 'panelMsg'; msg.style.cssText = 'margin-top:6px;font-size:11px;color:#06c;min-height:14px'; root.appendChild(msg);
    function flash(text) { const m = root.querySelector('#panelMsg'); if (m) { m.textContent = text; setTimeout(() => { if (m.textContent === text) m.textContent = ''; }, 2500); } }
  }
  build();
  root.hidden = !new URLSearchParams(location.search).has('dev');
  addEventListener('keydown', (e) => { if (e.key === '`') root.hidden = !root.hidden; });
}
