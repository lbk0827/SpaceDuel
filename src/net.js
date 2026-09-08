// P2P 전송 계층. 게임 규칙을 모르고 메시지만 나른다.
// transport 'trystero' = WebRTC + 공용 시그널링(서버 없음) / 'bc' = BroadcastChannel(같은 브라우저 두 탭, 테스트용)
//
// 슬롯 배정은 협상하지 않는다: 참가자 id 를 정렬해 그 순서를 슬롯 인덱스로 쓴다.
// 모두가 같은 목록에서 같은 답을 내므로 roster 교환이 필요 없고, 0번이 자동으로 방장이 된다.

export const APP_ID = 'space-duel-lbk';
export const MAX_PLAYERS = 4;

/** 참가자 id 목록 → 정렬된 명단(슬롯 순서). 순수 함수 */
export function rosterOf(selfId, peerIds) {
  return [selfId, ...peerIds].filter(Boolean).sort().slice(0, MAX_PLAYERS);
}
export const slotIndexOf = (roster, id) => roster.indexOf(id);
/**
 * 방장: 지정된 사람(방을 만든 사람)이 명단에 있으면 그 사람, 없으면 정렬 0번이 승계.
 * 초대 링크에 방장 id 를 실어 나르므로 모두가 같은 결론을 낸다.
 */
export const hostOf = (roster, preferredId) =>
  (preferredId && roster.includes(preferredId) ? preferredId : roster[0]);

/** 방 코드: 헷갈리는 문자(0/O/1/I) 제외 */
export function makeRoomCode(len = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

const TYPES = ['fire', 'hit', 'pose', 'state', 'item', 'presence'];

export async function createNet({ roomCode, transport = 'trystero', hostId = null }) {
  const handlers = new Map(TYPES.map((t) => [t, []]));
  let rosterListener = () => {};
  let roster = [];
  let peerIds = [];
  let selfId;
  let impl;
  let preferredHost = hostId;

  function refreshRoster() {
    const next = rosterOf(selfId, peerIds);
    const changed = next.join(',') !== roster.join(',');
    roster = next;
    if (changed) rosterListener(roster);
  }

  if (transport === 'bc') {
    // ---- BroadcastChannel: 같은 브라우저의 다른 탭끼리. 외부 시그널링 없이 테스트 가능 ----
    selfId = 'bc-' + Math.random().toString(36).slice(2, 10);
    const ch = new BroadcastChannel('space-duel:' + roomCode);
    const seen = new Map(); // peerId → 마지막 수신 시각
    const HEARTBEAT = 700, TIMEOUT = 2500;

    ch.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg || msg.from === selfId) return;
      seen.set(msg.from, Date.now());
      if (!peerIds.includes(msg.from)) { peerIds = [...peerIds, msg.from]; refreshRoster(); }
      if (msg.type === 'presence') return;
      for (const fn of handlers.get(msg.type) ?? []) fn(msg.data, msg.from);
    };
    const beat = setInterval(() => {
      ch.postMessage({ type: 'presence', from: selfId });
      const now = Date.now();
      const before = peerIds.length;
      peerIds = peerIds.filter((id) => now - (seen.get(id) ?? 0) < TIMEOUT);
      if (peerIds.length !== before) refreshRoster();
    }, HEARTBEAT);
    ch.postMessage({ type: 'presence', from: selfId });

    impl = {
      send(type, data) { ch.postMessage({ type, from: selfId, data }); },
      leave() { clearInterval(beat); ch.close(); },
    };
  } else {
    // ---- Trystero: WebRTC 직결. 시그널링을 공용 릴레이에 맡긴다 ----
    // 0.25 API: makeAction 은 { send, onMessage } 객체를 돌려주고, onPeerJoin/Leave 는 프로퍼티에 대입한다.
    const { joinRoom, selfId: sid } = await import('trystero/nostr');
    selfId = sid;
    const room = joinRoom({ appId: APP_ID }, roomCode);
    const actions = {};
    for (const t of TYPES) {
      if (t === 'presence') continue;
      const action = room.makeAction(t);
      actions[t] = action.send;
      action.onMessage = (data, ctx) => {
        const from = ctx && ctx.peerId;
        for (const fn of handlers.get(t) ?? []) fn(data, from);
      };
    }
    room.onPeerJoin = (id) => { if (!peerIds.includes(id)) { peerIds = [...peerIds, id]; refreshRoster(); } };
    room.onPeerLeave = (id) => { peerIds = peerIds.filter((x) => x !== id); refreshRoster(); };

    impl = {
      send(type, data) {
        const send = actions[type];
        // 상대가 없을 때/전송 실패는 게임을 멈출 이유가 아니다
        if (send) Promise.resolve(send(data)).catch(() => {});
      },
      leave() { Promise.resolve(room.leave()).catch(() => {}); },
    };
  }

  refreshRoster();

  return {
    get selfId() { return selfId; },
    get roster() { return roster; },
    get transport() { return transport; },
    isHost: () => hostOf(roster, preferredHost) === selfId,
    get hostId() { return hostOf(roster, preferredHost); },
    /** 방을 만든 사람이 자기 자신임을 확정할 때 */
    claimHost(id) { preferredHost = id; },
    mySlotIndex: () => slotIndexOf(roster, selfId),
    send: (type, data) => impl.send(type, data),
    on(type, fn) { handlers.get(type)?.push(fn); },
    onRoster(fn) { rosterListener = fn; fn(roster); },
    leave: () => impl.leave(),
  };
}
