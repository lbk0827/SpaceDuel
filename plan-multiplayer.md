# 온라인 멀티플레이 (초대 링크 · 최대 4인 난전 · 서버 없는 P2P) 구현 계획

> 설계 근거는 [`design.md`](design.md) §2 와 이 문서 §0. 실행은 슬라이스 단위로, 각 슬라이스 끝에 `npm test` + 헤드리스 검증.

## 0. 확정 결정 (2026-09-08 대화)

| 항목 | 결정 | 근거 / 기각 |
|---|---|---|
| 매칭 | **초대 링크만** (`?room=CODE`) | 공개 로버는 대기자 없으면 미완성처럼 보임 |
| 인원 | **최대 4인 난전**, 빈 자리는 봇 | — |
| 연결 | **서버 없는 P2P** — Trystero 0.25(WebRTC + 공용 시그널링) | 중계 서버는 계정·배포가 늘고 Pages 밖 조각 생김 |
| 발사 권위 | **각자 자기 발사를 로컬 즉시 실행** 후 이벤트 전송 | 몸이 초당 ~2회전 → 지연이 곧 조준 오차(100ms ≈ 60~90°). 상태 동기화만으로는 불가 |
| 명중 권위 | **쏜 쪽이 판정** → `hit{victim}` 브로드캐스트 | "맞췄는데 안 죽음" 방지 |
| 자세 동기 | 방장이 전 슬롯 자세를 30Hz 전송, 수신측은 **부드럽게 보정**(lerp) | 결정론·롤백 불필요. 2~4바디라 대역폭 무시 가능 |
| 봇 | **방장만 시뮬**하고 발사를 이벤트로 보냄 | 각자 돌리면 봇 행동이 화면마다 달라짐 |
| 라운드 | **마지막 생존자 승**(즉사 유지), 동시 전멸 = 무득점 | — |
| 방 크기 | 인원수에 따라 확대(16:9 유지): 1~2인 16×9 · 3인 19×10.7 · 4인 22×12.4 | 카메라가 폭에 맞춰 스케일 → 캐릭터가 자동으로 작아 보임 |
| 속도 보정 | `scaleWithArena`(기본 켬): `laserSpeed`·`recoilImpulse` × (방폭/16) | 방이 커져도 튜닝한 손맛 유지 |
| 테스트 전송 | `?transport=bc` = **BroadcastChannel**(같은 브라우저 두 탭) | 외부 시그널링 없이 헤드리스로 대전 검증 가능 |

## 1. 슬롯 모델 (전 코드 공통 규약)

```js
slot = { id: 'p0'|'p1'|'p2'|'p3', index, kind: 'local'|'remote'|'bot',
         peerId?, alive, score, gate /* FireGate */, aiMem? }
```

- 색 = 인덱스 고정: `p0` 파랑(방장) · `p1` 빨강 · `p2` 노랑 · `p3` 초록. **내 슬롯은 HUD 에 `YOU` 표시**
- 물리 바디 id = 슬롯 id. [physics.js](src/physics.js) `reset(spawns)` 가 이미 맵을 받으므로 배관만
- 스폰 = 방 크기 기준 네 모서리(좌상·우하·우상·좌하 순서로 배정 → 2인이면 대각선)

## 슬라이스 A — 4인 난전 구조 (오프라인 완결)

**Files:** `src/tuning.js`, `src/arena.js`(신규), `src/physics.js`, `src/renderer.js`, `src/sprites.js`, `src/hud.js`, `src/game.js`, `test/arena.test.js`(신규)

- [x] `src/arena.js` 순수 모듈: `arenaFor(playerCount, tuning)` → `{ width, height, halfW, halfH, speedScale }`, `spawnsFor(slotIds, arena)` → `{ p0: {x,y,facing}, ... }` (네 모서리, 안쪽 여유 1m, 서로 마주보는 facing)
- [x] 테스트: 2인 = 대각선 배치·간격 최대, 4인 = 네 모서리 모두 방 안(±(half−1)), 인원 늘면 width 증가, `speedScale = width/16`
- [x] `tuning.js`: `arenaWidthPerPlayer`(3), `scaleWithArena`(true), `botCount`(3) 추가. `WORLD.spawn` 제거(→ arena.js)
- [x] `physics.js`: 벽을 `reset()` 에서 재생성(방 크기 가변). 월드도 라운드마다 새로 만들어 잔여 상태 제거
- [x] `sprites.js`: 색 4종 팔레트 (`SLOT_COLORS[4]`), 스프라이트 캐시 키 = 색
- [x] `renderer.js`: `BOLT_COLORS` → 슬롯 인덱스 색. `scale`·벽 그리기를 `view.arena` 기준으로. 사망 슬롯은 안 그림
- [x] `hud.js`: 점수 pill N개(색 + YOU 표시), 게이지는 머리 위(이미 슬롯별)
- [x] `game.js`: `slots[]` 로 일반화. 라운드 = 마지막 생존자. 봇은 가장 가까운 생존 상대를 표적으로 `decide`
- [x] 검증: 헤드리스에서 4봇 난전이 라운드·매치까지 진행, 콘솔 에러 0

## 슬라이스 B — 전송 계층

**Files:** `src/net.js`(신규), `test/net-protocol.test.js`(신규)

- [x] 메시지 스키마(순수 함수로 encode/decode + 검증):
  - `hello{ slotIndexWanted }` · `roster{ slots }`(방장) · `fire{ slot, x, y, dx, dy }` · `hit{ shooter, victim }` · `pose{ [id]: [x,y,angle,vx,vy,angvel] }` · `round{ index, scores, arenaPlayers }`
- [x] `createNet({ roomCode, transport })` → `{ selfId, isHost(), peers(), send(type, data, toPeer?), on(type, fn), onRosterChange(fn), leave() }`
  - transport `'trystero'`: `joinRoom({ appId: 'space-duel-lbk' }, roomCode)`, `makeAction` 별 채널
  - transport `'bc'`: `BroadcastChannel('space-duel:'+roomCode)`, peer id 랜덤 — 테스트용
- [x] 방장 선출 = `[selfId, ...peerIds].sort()[0]` (입장·퇴장마다 재계산)
- [x] 테스트: encode/decode 왕복, 알 수 없는 타입 무시, 방장 선출 결정성

## 슬라이스 C — 게임에 배선

**Files:** `src/game.js`, `src/lobby.js`(신규), `dev.html`

- [x] 로비: `?room` 없으면 "혼자 하기"(→ 봇 수 선택: 1/2/3/연습, 유저 요청) / "방 만들기"(코드 생성 → `?room=` 로 이동 + 링크 복사). `?room` 있으면 대기 화면(인원 n/4, 링크 복사, 방장에게 "시작")
- [x] 발사: 로컬 즉시 → `send('fire')`. 수신 시 같은 `fire()` 경로로 주입(해당 슬롯)
- [x] 명중: 내 탄이 맞으면 `send('hit')` + 로컬 적용. 수신 `hit` 은 이미 죽은 슬롯이면 무시
- [x] 자세: 방장이 30Hz `pose` 전송. 비방장은 원격 슬롯은 강하게(0.5), 내 슬롯은 오차 0.5m 초과일 때만 보정
- [x] 라운드: 방장이 `round` 로 시작·점수 배포. 봇 슬롯 시뮬은 방장만
- [x] 이탈: `onPeerLeave` → 그 슬롯을 봇으로 전환(진행 중 라운드 유지)
- [x] 검증: **BroadcastChannel 두 탭 헤드리스 대전** — 양쪽에서 서로의 발사·명중·라운드 종료가 일치. 그다음 Trystero 실접속 확인

## 슬라이스 D — 마감 (검증 완료: BroadcastChannel 두 탭 대전 ✔ / Trystero 실 P2P 두 탭 대전 ✔ — 양쪽에서 상대 탄 관측·점수 일치)

- [x] `npm test` 전체 · `npm run build` · Pages 푸시
- [x] README: 초대 링크 사용법, 두 탭 테스트법(`?room=TEST&transport=bc`), 봇 채우기
- [x] design.md §2 에 멀티 결정 반영
