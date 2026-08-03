-- migrations/007_notifications.sql

CREATE TYPE notification_type AS ENUM (
  'APPLICATION_SUBMITTED',
  'APPLICATION_RECEIVED',
  'APPLICATION_APPROVED',
  'APPLICATION_REJECTED',
  'POT_COMPLETED',
  'POT_CANCELED'
);

CREATE TABLE IF NOT EXISTS notifications (
  id               BIGSERIAL PRIMARY KEY,
  recipient_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             notification_type NOT NULL,
  pot_id           UUID REFERENCES pots(id) ON DELETE CASCADE,
  participation_id UUID REFERENCES participations(id) ON DELETE SET NULL,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  action_path      TEXT,
  is_read          BOOLEAN NOT NULL DEFAULT false,
  read_at          TIMESTAMPTZ,
  dedupe_key       TEXT NOT NULL UNIQUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (is_read = false AND read_at IS NULL)
    OR
    (is_read = true AND read_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications (recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications (recipient_id, is_read, created_at DESC);
