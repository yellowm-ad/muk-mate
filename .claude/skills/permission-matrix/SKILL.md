---
name: permission-matrix
description: 먹메이트 서버 API의 권한 검사 기준. API 라우트·Server Action·채팅 접근 제어를 작성하거나 검토할 때 사용한다. "누가 이 API를 호출할 수 있는가", "권한 검사", "인가 로직" 관련 작업 시 사용한다.
---

## 원칙 (PRD 9-2, 11-3)

- 권한 검사는 **매 요청마다 서버에서** 수행한다. 화면에서 버튼을 숨기는 것으로 대체하지 않는다.
- 승인되지 않은 사용자가 URL을 직접 입력해도 보호된 리소스(특히 주문 채팅방)에 접근할 수 없어야 한다.
- 타인의 개인정보(로그인 아이디 등)는 어떤 응답에도 포함하지 않는다. 닉네임만 노출한다.

## 엔드포인트별 권한 기준 (PRD 11-3)

| 엔드포인트 | 권한 |
|---|---|
| `POST /api/auth/signup`, `GET /api/auth/check-id`, `POST/DELETE /api/auth/login`\|`logout` | 공개 |
| `PATCH /api/me`, `PATCH /api/me/password` | 본인만 |
| `GET /api/pots`, `GET /api/pots/:id` | 공개 |
| `POST /api/pots` | 로그인 사용자 |
| `PATCH /api/pots/:id` (수정/상태 변경) | **해당 모집자만** |
| `POST /api/pots/:id/applications` | 로그인 사용자 |
| `PATCH /api/applications/:id` (승인/거절) | **해당 모집자만** |
| `GET /api/places/search` | 로그인 사용자 |
| `GET /api/rooms` | 로그인 사용자 (본인이 속한 방만) |
| `GET/POST /api/rooms/:id/messages` | ORDER 타입: **모집자 + 승인된 참여자만** / COMMUNITY 타입: 로그인 사용자 누구나 |

## 구현 패턴

1. 세션 확인 (비로그인 → 401)
2. 리소스 소유권/참여 상태 확인 (권한 없음 → 403)
3. 통과 시에만 로직 실행

- 모집자 검사: `pots.host_id === session.user.id`.
- 채팅 참여자 검사: `participations`에서 `pot_id + user_id`로 `approval_status = 'APPROVED'` 행 존재 여부 확인 (모집자 본인도 APPROVED 행으로 존재하도록 설계되어 있음).
