---
name: mukmate-db-schema
description: Use when creating/modifying the Neon Postgres schema, Drizzle ORM models or migrations, or DB connection setup for MukMate (먹메이트). Triggers on schema files, migration files, drizzle.config.*, connection-string setup, or any new column touching money/time/coordinates.
---

Reference schema and DB rules for MukMate. Source of truth: `docs/PRD.md` §11-2, §10-3②.

## Connection — mandatory, not optional (§10-3②)

Serverless functions spin up an instance per request, so a direct Postgres connection string exhausts connections fast. Always use:
- Neon's **pooled connection string** (PgBouncer), or
- `@neondatabase/serverless` HTTP driver

A direct (non-pooled) connection string works fine locally and then causes **500 errors from connection exhaustion after deploying to Vercel** — this is a named, previously-seen failure mode, not a hypothetical.

## Full schema (§11-2)

```sql
CREATE TYPE pot_status   AS ENUM ('OPEN','CLOSED','ORDERED','CANCELED');
CREATE TYPE approval     AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE room_type    AS ENUM ('ORDER','COMMUNITY');
CREATE TYPE message_type AS ENUM ('TEXT','SYSTEM');
CREATE TYPE target_type  AS ENUM ('HEADCOUNT','AMOUNT');
CREATE TYPE account_status AS ENUM ('ACTIVE','SUSPENDED','DISABLED');
CREATE TYPE report_reason AS ENUM ('HARASSMENT','SEXUAL_CONTENT','SPAM','FRAUD','NO_SHOW','PRIVACY','UNSAFE_MEETING','OTHER');
CREATE TYPE report_status AS ENUM ('PENDING','REVIEWING','RESOLVED','DISMISSED');

CREATE TABLE zones (
  code       text PRIMARY KEY,
  label      text NOT NULL,
  sort_order smallint NOT NULL DEFAULT 0
);

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id      text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  nickname      text NOT NULL,
  zone_code     text REFERENCES zones(code),
  account_status account_status NOT NULL DEFAULT 'ACTIVE',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE pots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id        uuid NOT NULL REFERENCES users(id),
  zone_code      text NOT NULL REFERENCES zones(code),
  store_name     text NOT NULL,
  store_address  text,
  store_lat      numeric(10,7),
  store_lng      numeric(10,7),
  order_summary  text NOT NULL,
  target_type    target_type NOT NULL,
  target_value   integer NOT NULL,
  delivery_fee   integer,
  deadline_at    timestamptz NOT NULL,
  pickup_at      timestamptz,
  pickup_name    text NOT NULL,
  pickup_address text,
  pickup_lat     numeric(10,7),
  pickup_lng     numeric(10,7),
  pickup_note    text,
  extra_note     text,
  status         pot_status NOT NULL DEFAULT 'OPEN',
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pots_zone_status ON pots (zone_code, status, deadline_at);

CREATE TABLE participations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pot_id          uuid NOT NULL REFERENCES pots(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users(id),
  apply_message   text,
  menu_amount     integer,
  approval_status approval NOT NULL DEFAULT 'PENDING',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pot_id, user_id)
);
CREATE INDEX idx_participations_user ON participations (user_id, created_at DESC);
CREATE INDEX idx_participations_pending ON participations (pot_id, created_at) WHERE approval_status = 'PENDING';  -- host's pending-requests query

CREATE TABLE chat_rooms (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type       room_type NOT NULL,
  pot_id     uuid UNIQUE REFERENCES pots(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id         bigserial PRIMARY KEY,
  room_id    uuid NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id  uuid REFERENCES users(id),
  type       message_type NOT NULL DEFAULT 'TEXT',
  content    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_room ON messages (room_id, id);

CREATE TABLE reports (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id              uuid NOT NULL REFERENCES users(id),
  reported_user_id         uuid NOT NULL REFERENCES users(id),
  room_id                  uuid REFERENCES chat_rooms(id) ON DELETE SET NULL,
  message_id               bigint REFERENCES messages(id) ON DELETE SET NULL,
  reason                   report_reason NOT NULL,
  detail                   text,
  message_content_snapshot text,
  message_created_snapshot timestamptz,
  status                   report_status NOT NULL DEFAULT 'PENDING',
  admin_note               text,
  reviewed_at              timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reporter_id, message_id)
);
CREATE INDEX idx_reports_status_created ON reports (status, created_at);
```

## Conventions to enforce

- **Money is always `integer` (KRW)** — never `float`/`numeric` for amounts, or split-cost math (§5-4) accumulates rounding error.
- **All timestamps are `timestamptz`**, displayed in KST consistently (§9-3) — don't store naive local time.
- `messages.id` is `bigserial` specifically so chat polling can do `WHERE room_id = $1 AND id > $2` as an incremental cursor — don't switch it to `uuid`.
- `participations` has `UNIQUE (pot_id, user_id)` — rely on this constraint for dedup, don't re-implement the check only in application code.
- The host should also get an `APPROVED` row in `participations` for their own pot (design memo, §11-2) — keeps headcount and chat-permission logic uniform.
- No account/bank-info columns anywhere — financial info is never persisted (§9-2, §12); settlement guidance goes in chat text only.
- `zones` is a table, not an enum, because the region list is still undecided (§17-1) — changing the region list should be a data change, not a migration.
- `reports.status`/`users.account_status` currently have no code path that ever changes them off their defaults (`PENDING`/`ACTIVE`) — there's no admin review flow yet (§17-3). Don't assume moderation actions actually take effect just because the columns exist.
- **Migration workflow (resynced 2026-07-30)**: `reports`/`account_status` had been added to `schema.ts` and pushed to Neon by hand, skipping `drizzle-kit generate` — the `drizzle/` migration history (`0000`/`0001`) didn't reflect them. A hand-written one-off file (`migrations/006_join_approval.sql`, outside the `drizzle/` folder) had also been created for a `participations` index but never applied, and defined two columns (`decided_at`, `decided_by`) nothing in the codebase ever read — it was deleted rather than resurrected. `drizzle/0002_empty_martin_li.sql` now captures the full diff and the migration history matches the live DB again. **Keep it that way**: always run `npm run db:generate` right after editing `schema.ts`, before `npm run db:push` — don't push schema changes without generating a migration file first.
