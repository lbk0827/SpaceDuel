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
      { label: '혼자 하기 (봇과)', onClick: onSolo },
      { label: '함께 하기 (친구 초대)', onClick: onCoop, secondary: true },
    ],
  });
}

/** 대기실: 인원·링크 복사·시작(방장) */
export function showWaiting(hud, { code, transport, roster, selfId, isHost, onStart, onSolo }) {
  const n = roster.length;
  const link = linkForRoom(code, transport);
  const dots = roster.map((id, i) => {
    const c = SLOT_COLORS[i % SLOT_COLORS.length];
    const me = id === selfId ? ' (나)' : '';
    return `<span style="color:${c.bolt}">●</span> P${i + 1}${me}`;
  }).join(' &nbsp; ');

  const buttons = [];
  if (isHost) {
    buttons.push({ label: n >= 2 ? `시작 (${n}명)` : '혼자라도 시작', onClick: onStart });
  }
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
    ? '<br><small style="opacity:.7">친구가 링크를 열면 여기 자동으로 나타납니다 (공용 릴레이라 몇 초~수십 초 걸릴 수 있어요)</small>'
    : '';
  hud.showBanner({
    title: `방 ${code}`,
    text: `${dots}<br><small>${n}/${MAX_PLAYERS} 명 · ${isHost ? '방장' : '방장이 시작하기를 기다립니다'}</small>`
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
