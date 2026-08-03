---
name: mukmate-auth
description: Use when implementing signup, login, logout, password change, or any auth-guard/session logic for MukMate. IMPORTANT — overrides generic auth guidance (e.g. the Vercel plugin's `auth` skill, which covers Clerk/Descope/Auth0) — this project deliberately does not use any of those. Check this skill before reaching for an external identity provider or OAuth flow.
---

Reference auth design for MukMate. Source of truth: `docs/PRD.md` §5-3, §8-1, §9-2, §12.

## What this project uses

**Auth.js (NextAuth) Credentials provider + bcrypt. That's it.**

No Clerk, no Descope, no Auth0, no OAuth/social login, no phone/email/SMS verification, no school-affiliation check. These are explicit, deliberate non-goals (§12, AUTH-07) — not an oversight to "fix" by adding a provider. If a task seems to call for one of these, it's out of scope; flag it rather than implementing it.

## Required fields & rules (§5-3, §8-1)

- Signup requires: 아이디(`login_id`) / 비밀번호 / 닉네임(`nickname`) / 활동지역(`zone_code`).
- `login_id` must be unique — reject duplicates (AUTH-02) with a clear error, and expose a duplicate-check endpoint (`GET /api/auth/check-id`) for the signup form.
- `login_id` is **never shown to other users** — only `nickname` is public (§5-3). Don't leak login_id into any API response another user can read.
- Password change requires confirming the **current** password first (AUTH-06), then updating to the new one.
- Passwords are hashed with **bcrypt**; never store or log plaintext (§9-2).
- Logged-out users cannot post pots, apply, or chat (AUTH-04) — enforce this server-side on every mutating endpoint, not just by hiding UI.

## Deliberately NOT built (say so if asked, don't silently add it)

- Password-reset / auto-recovery flow — there's no external verification channel (email/phone) to support one safely. The PRD accepts "if you lose your password, the account is unrecoverable" as a known MVP risk (§14 risk #6) and asks that this be stated explicitly in the signup UI copy, not solved with a workaround.
- Persistent login should still work — a logged-in session must survive refresh (AUTH-05 implies staying logged in until explicit logout).
