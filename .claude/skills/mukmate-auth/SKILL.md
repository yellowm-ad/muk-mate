---
name: mukmate-auth
description: Use when implementing signup, login, logout, password change, or any auth-guard/session logic for MukMate. IMPORTANT — overrides generic auth guidance (e.g. the Vercel plugin's `auth` skill, which covers Clerk/Descope/Auth0) — this project deliberately does not use any of those. Check this skill before reaching for an external identity provider or OAuth flow.
---

Reference auth design for MukMate. Source of truth: `docs/PRD.md` §5-3, §8-1, §9-2, §12.

## What this project uses

**Auth.js (NextAuth) Credentials provider + bcrypt. That's it.**

No Clerk, no Descope, no Auth0, no OAuth/social login, no phone/SMS verification, no general school-affiliation check. These are explicit, deliberate non-goals (§12, AUTH-07) — not an oversight to "fix" by adding a provider. If a task seems to call for one of these, it's out of scope; flag it rather than implementing it.

**Exception (2026-08-14, see CLAUDE.md):** signup now requires 전북대 이메일(@jbnu.ac.kr) verification via a Resend-sent one-time code (`app/api/auth/jbnu-email/*`, `lib/email.ts`) — this is a deliberate, user-approved override of the §12/AUTH-07 non-goal, scoped narrowly to JBNU email only (still no phone/SMS, still no password-reset flow). New signups only; existing accounts are unaffected. The email is admin-only visible (`/admin/users`) plus a self-view on `/my/edit` — never shown to other users or carried in the session/JWT.

## Required fields & rules (§5-3, §8-1)

- Signup requires: 아이디(`login_id`) / 비밀번호 / 닉네임(`nickname`) / 활동지역(`zone_code`).
- `login_id` must be unique — reject duplicates (AUTH-02) with a clear error, and expose a duplicate-check endpoint (`GET /api/auth/check-id`) for the signup form.
- `login_id` is **never shown to other users** — only `nickname` is public (§5-3). Don't leak login_id into any API response another user can read.
- Password change requires confirming the **current** password first (AUTH-06), then updating to the new one.
- Passwords are hashed with **bcrypt**; never store or log plaintext (§9-2).
- Logged-out users cannot post pots, apply, or chat (AUTH-04) — enforce this server-side on every mutating endpoint, not just by hiding UI.

## Deliberately NOT built (say so if asked, don't silently add it)

- Persistent login should still work — a logged-in session must survive refresh (AUTH-05 implies staying logged in until explicit logout).

**Exception (2026-08-14, see CLAUDE.md):** password-reset/auto-recovery was ALSO overridden, on top of the JBNU email exception above — accounts with a verified `jbnu_email` can now find their login ID (`/find-id`) and reset their password (`/find-password`) via the same email-code channel, and change their login ID from `/my/edit` (also requires a fresh code + current password). All four flows share `lib/email-verification.ts` (`requestVerificationCode`/`checkVerificationCode`/`getValidVerification`/`markVerificationConsumed`), keyed by a `purpose` column so a code issued for one purpose can't be replayed for another. Legacy accounts without `jbnu_email` still have no recovery path — PRD §14 risk #6 still applies to them specifically.
