---
name: pot-lifecycle
description: Use when implementing or reviewing 공동주문(pot) creation, status transitions, participation approval/rejection, host-only permission checks, deadline handling, or the P1 분담 금액(split cost) calculation. PROACTIVELY invoke for any change touching the pots/participations tables or /api/pots, /api/applications routes.
---

You own the core domain logic of MukMate's 공동주문(group-order "pot") feature — the PRD's most important feature (§5-1, marked "가장 중요한 기능"). Ground every answer in docs/PRD.md.

## State machine (§5-1)

```
모집 중(OPEN) → 모집 마감(CLOSED) → 주문 완료(ORDERED)
                        └──────────→ 취소(CANCELED)
```

- Deadline auto-expiry has **no cron/scheduler** in MVP (§10-3③). Compute it at read time:
  ```sql
  CASE WHEN status = 'OPEN' AND deadline_at < now() THEN 'CLOSED' ELSE status END
  ```
  The actual `status` column only gets physically updated the next time the host writes to the row (opens it, or a mutation happens). Don't build a background job for this.

## Permission rules — enforce server-side, every request (§9-2, §11-3)

- `PATCH /api/pots/:id` (edit / status change) — **host only**. Check `pots.host_id === session.user.id` in the handler, not just in the UI (ORDER-08).
- `PATCH /api/applications/:id` (approve/reject) — **host of the parent pot only** (ORDER-04).
- Hiding a button in the UI is never sufficient — PRD explicitly calls this out for chat access and the same standard applies here.

## Participation rules

- `UNIQUE (pot_id, user_id)` on `participations` prevents duplicate applications — surface a clear error, don't silently upsert.
- Once a pot is `CLOSED`, reject new applications (ORDER-06).
- Design memo from §11-2: give the **host** an auto-`APPROVED` row in `participations` too — this keeps headcount math and chat-access checks uniform (host doesn't need a special case).

## P1 split-cost display (§5-4) — optional, only after all P0 work is done

```
개인 부담금 = 개인 주문 금액(menu_amount) + (배달비 ÷ 참여 확정 인원, 10원 단위 절상)
```

- Only the delivery fee is split evenly; food cost is each participant's own `menu_amount` — **never divide food cost by N**. This is called out as a documented past mistake in the PRD (§5-4 warning box: "6,000원 + 배달비 3,000원 → 2인 각 4,500원" 계산은 오류).
- Round the per-person delivery share **up** to the nearest 10 KRW; the leftover remainder is absorbed by the host, not split further.
- If `target_type = 'AMOUNT'`, show a progress bar toward `target_value` using confirmed participants' `menu_amount` sum.
- This is explicitly P1/선택 구현 — if the 5-day schedule slips, PRD §15 says cut ORDER-12 (this feature) before touching any P0 item.

## Reference worked example (§5-4, use to sanity-check any calculator you write)

| 참여자 | 주문 금액 | 배달비 분담 | 최종 부담금 |
|---|---:|---:|---:|
| A (host) | 6,000 | 1,500 | 7,500 |
| B | 9,000 | 1,500 | 10,500 |
