---
name: chat-polling
description: Use when implementing or reviewing chat rooms — order chat, the fixed 음식 커뮤니티 rooms, message polling, or room-access permission checks. PROACTIVELY invoke for any change touching chat_rooms/messages tables or /api/rooms routes.
---

You own MukMate's chat system (PRD §5-2, §10-3①, §11). This is a serverless deployment on Vercel — design decisions here are load-bearing, not arbitrary style choices.

## Why polling, not WebSocket/SSE (§10-3①)

Vercel serverless functions cannot hold long-lived socket connections. The PRD has already decided: **polling every 2-3 seconds** is the MVP approach. Do not introduce WebSocket/SSE/Pusher/Ably unless the user explicitly asks to upgrade beyond MVP — it's out of scope and adds external dependencies the PRD deliberately avoided.

- Use `messages.id` (`bigserial`) as an incrementing cursor: `GET /api/rooms/:id/messages?after=<lastId>` → `WHERE room_id = $1 AND id > $2 ORDER BY id`. Never re-fetch the whole history on each poll.
- **Stop polling when the chat screen isn't visible/focused** (component unmount, tab hidden, navigated away) — PRD explicitly calls out cutting unnecessary DB calls this way (§10-3①).
- "새 메시지가 화면에 갱신된다" (CHAT-06) is satisfied by polling — don't over-engineer toward real-time push to hit this requirement.

## Permission — CHAT-01, enforced on the server, every request

- Only the host and `APPROVED` participants of a pot may read or write to its `ORDER`-type room. Rejected and non-applicant users must get a 403 even if they guess/type the room URL directly (this is a named completion-criterion in §13-1: "승인되지 않은 계정은 URL을 직접 입력해도 해당 채팅방에 접근할 수 없다").
- Check membership via the `participations` table (`approval_status = 'APPROVED'`) inside every `/api/rooms/:id/messages` handler (GET and POST) — never rely on client-side route guards alone.
- `COMMUNITY`-type rooms (the fixed 음식 커뮤니티 rooms) are open to any logged-in user — no approval check needed, just an auth check.

## Schema notes (§11-2)

- `chat_rooms` is a single table for both `ORDER` and `COMMUNITY` types (`type room_type`) — reuse the same message read/write logic for both, branch only on the permission check.
- `messages.sender_id` is nullable for `SYSTEM`-type messages (e.g. "모집이 마감되었습니다").
- Display **nickname** + timestamp on each message — never expose `login_id` to other users (§5-3 account policy).
- Order chat rooms show a pinned header: 가게명 · 수령 장소 · 수령 예정 시각 (CHAT-07, screen #9).

## Community rooms (§17-2)

MVP ships exactly 2 fixed rooms, created by the operator (not user-creatable):
1. 오늘 뭐 먹지 · 맛집 추천
2. 같이 먹어요 · 음식 여행

Users cannot create new public rooms in MVP — don't add a "create room" affordance.
