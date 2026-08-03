---
name: mukmate-chat-polling
description: Use when implementing or reviewing chat rooms for MukMate — order chat, the fixed 음식 커뮤니티 rooms, message polling, or room-access permission checks. Triggers on chat_rooms/messages code or /api/rooms routes.
---

Reference for MukMate's chat system. Source of truth: `docs/PRD.md` §5-2, §10-3①, §11, §17-2.

## Why polling, not WebSocket/SSE

Vercel serverless functions can't hold long-lived sockets. The PRD has already decided: **polling every 2-3 seconds**. Don't introduce WebSocket/SSE/Pusher/Ably unless explicitly asked to go beyond MVP.

- Use `messages.id` (`bigserial`) as an incrementing cursor: `GET /api/rooms/:id/messages?after=<lastId>` → `WHERE room_id = $1 AND id > $2 ORDER BY id`. Never refetch full history each poll.
- **Stop polling when the chat screen isn't visible/focused** (unmount, tab hidden, navigated away) — this cuts unnecessary DB calls and is explicitly called out in the PRD.
- CHAT-06 ("새 메시지가 화면에 갱신된다") is satisfied by polling — don't over-build toward real-time push chasing this requirement.

## Permission — CHAT-01, enforced server-side, every request

- Only the host and `APPROVED` participants (via `participations.approval_status`) may read/write an `ORDER`-type room.
- Rejected/non-applicant users must get a 403 **even if they type the room URL directly** — this is a named completion criterion (§13-1).
- `COMMUNITY`-type rooms are open to any logged-in user, no approval check — just an auth check.

## Schema notes

- One `chat_rooms` table serves both `ORDER` and `COMMUNITY` types — reuse the same message read/write logic, branch only on the permission check.
- `messages.sender_id` is nullable for `SYSTEM` messages (e.g. "모집이 마감되었습니다").
- Show **nickname** + timestamp on each message — never expose `login_id`.
- Order-chat rooms pin a header: 가게명 · 수령 장소 · 수령 예정 시각 (CHAT-07, screen #9).

## Community rooms (§17-2)

MVP ships exactly 2 operator-created fixed rooms — users cannot create new public rooms:
1. 오늘 뭐 먹지 · 맛집 추천
2. 같이 먹어요 · 음식 여행

## Reporting (CHAT-08, §17-3 — shipped in v2.2)

`POST /api/reports` lets a logged-in user report a message or user from within a chat room (`report-modal.tsx` in `chat-room-view.tsx`). Requirements when touching this:
- Verify room access via `getRoomForViewer()` before accepting a report tied to a `roomId` — same permission check as reading/sending messages.
- Block self-reports and duplicate reports of the same message (`UNIQUE(reporter_id, message_id)`).
- Snapshot the reported message's content/timestamp into the report row — the original message can be edited/deleted later and the report should still show what was actually said.
- There is **no admin review UI or API yet** — reports sit at `status = 'PENDING'` forever. Don't assume `reviewed_at`/`admin_note`/`account_status` get set anywhere; if you need moderation actions to actually take effect, that flow doesn't exist and needs to be built.
