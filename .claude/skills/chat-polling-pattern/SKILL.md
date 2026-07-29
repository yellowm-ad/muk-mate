---
name: chat-polling-pattern
description: 주문 채팅·커뮤니티 채팅의 폴링 기반 메시지 조회/전송을 구현할 때 사용한다. 채팅 API, 폴링 훅, 메시지 증분 조회 작성 시 사용한다.
---

## 원칙 (PRD 10-3 ①)

- WebSocket·SSE·외부 실시간 서비스를 쓰지 않는다. **2~3초 간격 폴링**만 사용한다.
- 마지막으로 받은 `messages.id`(bigserial) 이후만 조회한다: `WHERE room_id = $1 AND id > $2 ORDER BY id`.
- 채팅방을 벗어나면(언마운트, 탭 비활성) 폴링 인터벌을 정리해 불필요한 DB 호출을 줄인다.

## 서버

- `GET /api/rooms/:id/messages?after=<lastId>` — 증분 조회. 권한 검사(permission-matrix 스킬 참고)를 먼저 수행한다.
- `POST /api/rooms/:id/messages` — 메시지 전송. 저장 후 생성된 메시지(id, 작성 시각 포함)를 반환한다.

## 클라이언트

- `useChatPolling(roomId)` 같은 훅으로 `setInterval` + 마지막 id 상태를 관리한다.
- 컴포넌트 언마운트 또는 `document.visibilitychange`(탭 전환) 시 인터벌을 정리한다.
- 메시지 전송 성공 시 폴링 결과를 기다리지 않고 낙관적으로 목록에 먼저 반영해도 된다 (선택).
