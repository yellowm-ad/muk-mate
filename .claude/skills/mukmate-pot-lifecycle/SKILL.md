---
name: mukmate-pot-lifecycle
description: Use when implementing or reviewing 공동주문(pot) creation, status transitions, participation approval/rejection, host-only permission checks, deadline handling, or the P1 split-cost calculation. Triggers on code touching pots/participations tables or /api/pots, /api/applications routes.
---

Reference for MukMate's core domain logic — 공동주문, the PRD's top-priority feature (§5-1). Source of truth: `docs/PRD.md` §5-1, §5-4, §9-2, §10-3③, §11-2, §11-3.

## State machine

```
모집 중(OPEN) → 모집 마감(CLOSED) → 주문 완료(ORDERED)
                        └──────────→ 취소(CANCELED)
```

Deadline expiry has **no cron/scheduler** in MVP (§10-3③) — compute it at read time:
```sql
CASE WHEN status = 'OPEN' AND deadline_at < now() THEN 'CLOSED' ELSE status END
```
The physical `status` column updates lazily, the next time the host writes to the row. Don't add a background job for this.

## Permission rules — server-side, every request

- `PATCH /api/pots/:id` (edit/status) — **host only** (`pots.host_id === session.user.id`), verified in the handler (ORDER-08).
- `PATCH /api/pots/:id/members/:userId` (approve/reject) — **host of the parent pot only** (ORDER-04). This is the single path for approve/reject; a parallel `PATCH /api/applications/:id` existed briefly and was removed 2026-07-30 — don't recreate a second path.
- UI hiding a button is never sufficient — this standard is explicit elsewhere in the PRD for chat access and applies equally here.

## Participation rules

- `UNIQUE (pot_id, user_id)` prevents duplicate applications — surface a clear error, don't silently upsert.
- `CLOSED` pots reject new applications (ORDER-06).
- Give the host an auto-`APPROVED` row in `participations` too (§11-2 design memo) — keeps headcount math and chat-access checks uniform.

## P1 split-cost display (§5-4) — build only after all P0 work is done

```
개인 부담금 = 개인 주문 금액(menu_amount) + (배달비 ÷ 참여 확정 인원, 10원 단위 절상)
```

- Only delivery fee splits evenly; food cost is each participant's own `menu_amount` — **never divide food cost by N** (a documented past mistake in the PRD, §5-4 warning box).
- Round each person's delivery share **up** to the nearest 10 KRW; the remainder is absorbed by the host.
- `target_type = 'AMOUNT'` → show a progress bar toward `target_value` from confirmed participants' `menu_amount` sum.
- If the 5-day schedule slips, this is one of the first things cut (§15) — never let it block a P0 feature.

Worked example (§5-4):

| 참여자 | 주문 금액 | 배달비 분담 | 최종 부담금 |
|---|---:|---:|---:|
| A (host) | 6,000 | 1,500 | 7,500 |
| B | 9,000 | 1,500 | 10,500 |
