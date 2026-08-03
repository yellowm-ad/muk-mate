---
name: mukmate-api-contract
description: Use when adding or reviewing a Next.js Route Handler / Server Action under app/api for MukMate, or when deciding who is allowed to call an endpoint. Triggers on new API routes, pots/applications/rooms handlers, or permission questions for a given route.
---

Reference API surface for MukMate. Source of truth: `docs/PRD.md` §11-3.

## Endpoint table

| Method | Path | Description | Permission |
|---|---|---|---|
| POST | `/api/auth/signup` | Signup (incl. duplicate-id check) | Public |
| GET | `/api/auth/check-id?loginId=` | Duplicate login_id check | Public |
| POST | `/api/auth/login` / `logout` | Login / logout | Public |
| PATCH | `/api/me` | Edit nickname / zone | Self only |
| PATCH | `/api/me/password` | Change password (after current-password check) | Self only |
| GET | `/api/pots?zone=&status=` | Pot list | Public |
| POST | `/api/pots` | Create a pot | Logged in |
| GET | `/api/pots/:id` | Pot detail + participants + (P1) split calc | Public |
| PATCH | `/api/pots/:id` | Edit pot / change status | **Host only** |
| POST / DELETE | `/api/pots/:id/join` | Apply to join / cancel-or-leave | Logged in |
| GET | `/api/pots/:id/requests` | List pending join requests | **Host only** |
| PATCH | `/api/pots/:id/members/:userId` | Approve / reject, keyed by `userId` | **Host only** |
| GET | `/api/places/search?q=` | Kakao Local API keyword-search proxy | Logged in |
| GET | `/api/rooms` | My chat rooms + fixed community rooms | Logged in |
| GET | `/api/rooms/:id/messages?after=` | Incremental message fetch (polling) | **Room participant only** |
| POST | `/api/rooms/:id/messages` | Send message | **Room participant only** |
| POST | `/api/reports` | Report a message / user | Logged in |

`/api/pots/:id/join` + `/requests` + `/members/:userId` is the **only** path for the join → approve/reject flow — both the pot detail page and the "참여 신청자 관리" screen (#7) call it. An older parallel path (`POST /api/pots/:id/participations`, `PATCH /api/applications/:id`) existed briefly after FEAT-06 and was removed 2026-07-30; don't reintroduce a second path for this flow.

## Non-negotiable rule

> "채팅방 접근 권한(CHAT-01)은 모든 메시지 API에서 매 요청마다 서버가 검사한다. 화면에서 버튼을 숨기는 것만으로는 요구사항을 충족하지 못한다." (§11-3)

Every handler marked **host only** or **room participant only** above must re-verify that permission from the database inside the handler itself, on every call — not rely on the client hiding a button or route-guarding in middleware alone. This is one of the named completion criteria (§13-1): a rejected/non-applicant account hitting the room URL directly must get a 403.

## Data flow rule (§10-2)

All DB reads/writes happen in Route Handlers / Server Actions — never in a Client Component. Kakao API calls happen server-side only, proxied through `/api/places/search`; the client never calls `dapi.kakao.com` directly (that would leak the REST API key).
