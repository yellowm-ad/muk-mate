---
name: mukmate-mvp-scope-guard
description: Use before considering a MukMate feature "done", when a task's scope is ambiguous, or when a request smells like scope creep (payments, phone/email/school verification, native app, real-time push, AI recommendation/matching, ratings/points). Triggers when reviewing a PR or deciding whether to build something not explicitly in the PRD.
---

Scope reference for MukMate's 5-day MVP sprint. Source of truth: `docs/PRD.md` §12, §13, §15, §18.

## Priority order when a choice must be made (§18)

1. Can a pot be created and can participants be gathered for it?
2. Can the host manage applicants, and can approved people chat with each other?
3. Can a user re-check the status of their own orders?
4. Is the mobile-web flow simple and fast?
5. Anything not directly serving 1-4 is deferred past MVP.

## Hard non-goals (§12) — flag immediately if a request touches these

No native app · no in-app payment/remittance/escrow/auto-settlement (the split-cost display shows numbers only, never triggers a transfer) · no direct delivery-app integration · no live/background location tracking or exposing a user's live location · no user-created public rooms (only the 2 fixed ones) · no AI food recommendation or auto-matching · no school/phone/email/SMS verification · no password-reset/auto-recovery · no separate restaurant/courier accounts · no ratings/tiers/points/coupons · no push notifications (in-app badge only).

## Schedule-risk cut order (§15) — if the sprint slips, cut in this order

1. Screens #10/#11 (음식 커뮤니티) first
2. ORDER-10 (거리 표시, P1)
3. ORDER-12 (분담 금액 표시, P1)
4. The 3 P0 core features are never cut — completeness there matters more than screen count.

## Completion checklist (§13-1, §13-2) — use as acceptance criteria for "is this done"

- Two independent accounts sign up/log in; duplicate login_id rejected
- A pot can be created with a Kakao-search-selected store + pickup location
- Another account can find it, apply with a message, get approved/rejected by the host
- **A rejected/non-applicant account cannot reach the order chat even via direct URL**
- Host can close recruitment and mark the order complete
- Both accounts see their created/joined pots and statuses on 마이페이지, and can edit nickname/zone/password
- Community fixed-room chat works for any logged-in user
- Everything survives a refresh and a redeploy (Neon-backed), and works on the **Vercel production URL**, not just localhost
- Kakao REST API key never appears in the browser devtools network tab

Don't accept "it's done" on a single happy-path demo — check against this list.
