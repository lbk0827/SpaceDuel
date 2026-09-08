// 시작 화면(혼자하기 / 함께하기)과 대기실. 배너 UI 를 재사용한다.
import { makeRoomCode, MAX_PLAYERS } from './net.js';
import { SLOT_COLORS } from './sprites.js';

const params = () => new URLSearchParams(location.search);
export const roomFromUrl = () => (params().get('room') || '').toUpperCase() || null;
export const transportFromUrl = () => (params().get('transport') === 'bc' ? 'bc' : 'trystero');

export function linkForRoom(code, transport) {
  const u = new URL(location.href);
  u.searchParams.set('room', code);
  if (transport === 'bc') u.searchParams.set('transport', 'bc');
  else u.searchParams.delete('transport');
  return u.toString();
}

/** 시작 화면: 혼자하기 / 함께하기 */
export function showStart(hud, { onSolo, onCoop }) {
  hud.showBanner({
    title: 'SPACE DUEL',
    text: '클릭 한 번으로 발사 — 반동으로 움직여 상대를 맞히세요',
    buttons: [
      { label: '혼자 하기', onClick: onSolo },
      { label: '함께 하기 (친구 초대)', onClick: onCoop, secondary: true },
    ],
  });
}

/** 혼자 하기 설정: 봇 몇 명과 붙을지 */
export function showSoloSetup(hud, { current, onPick, onBack }) {
  const label = (n) => (n === 0 ? '연습 (봇 없음)' : `봇 ${n}명 (${n + 1}인 난전)`)
    + (n === current ? ' ✓' : '');
  hud.showBanner({
    title: '혼자 하기',
    text: '봇 수를 고르세요<br><small style="opacity:.7">인원이 많으면 방이 넓어집니다 · 연습은 라운드가 끝나지 않습니다</small>',
    buttons: [
      { label: label(1), onClick: () => onPick(1) },
      { label: label(2), onClick: () => onPick(2) },
      { label: label(3), onClick: () => onPick(3) },
      { label: label(0), onClick: () => onPick(0), secondary: true },
      { label: '뒤로', onClick: onBack, secondary: true },
    ],
  });
}

/** 대기실: 인원·링크 복사·시작(방장) */
export function showWaiting(hud, { code, transport, roster, selfId, isHost, botCount = 3, onStart, onSolo }) {
  const n = roster.length;
  const link = linkForRoom(code, transport);
  const dots = roster.map((id, i) => {
    const c = SLOT_COLORS[i % SLOT_COLORS.length];
    const me = id === selfId ? ` <b>(나 · ${c.name})</b>` : '';
    return `<span style="color:${c.bolt}">●</span> P${i + 1}${me}`;
  }).join(' &nbsp; ');

  // 시작은 누구나 누를 수 있다 — 방장은 무작위로 정해지므로 초대한 사람이 못 누르면 이상하다.
  // 혼자여도 봇을 채워 바로 시작할 수 있고, 친구는 들어오는 대로 다음 라운드부터 합류한다.
  const buttons = [];
  if (n >= 2) buttons.push({ label: `시작 (${n}명)`, onClick: () => onStart({ fillBots: false }) });
  else buttons.push({ label: `봇 넣고 시작 (봇 ${botCount}명)`, onClick: () => onStart({ fillBots: true }) });
  buttons.push({
    label: '초대 링크 복사',
    secondary: true,
    onClick: async () => {
      try { await navigator.clipboard.writeText(link); }
      catch { window.prompt('이 링크를 친구에게 보내세요', link); }
    },
  });
  if (onSolo) buttons.push({ label: '혼자 하기로', secondary: true, onClick: onSolo });

  const waitingNote = n < 2
    ? '<br><small style="opacity:.7">친구가 링크를 열면 여기 자동으로 나타납니다 (공용 릴레이라 몇 초~수십 초 걸릴 수 있어요)'
      + '<br>기다리지 않고 <b>봇 넣고 시작</b>해도 됩니다 — 친구는 들어오는 대로 다음 라운드부터 합류합니다</small>'
    : '';
  hud.showBanner({
    title: `방 ${code}`,
    text: `${dots}<br><small>${n}/${MAX_PLAYERS} 명 · 누구나 시작할 수 있습니다${isHost ? ' (내가 방장)' : ''}</small>`
      + waitingNote
      + `<br><small style="opacity:.5">${link}</small>`,
    buttons,
  });
}

/** 함께 하기: URL 에 방이 없으면 새 코드로 이동(히스토리만 갱신) */
export function ensureRoom(transport) {
  let code = roomFromUrl();
  if (!code) {
    code = makeRoomCode();
    const u = new URL(location.href);
    u.searchParams.set('room', code);
    if (transport === 'bc') u.searchParams.set('transport', 'bc');
    history.replaceState(null, '', u.toString());
  }
  return code;
}
