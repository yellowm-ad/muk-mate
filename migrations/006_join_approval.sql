-- migrations/006_join_approval.sql

ALTER TABLE participations
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(10) NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS decided_by UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS idx_participations_pending
  ON participations (pot_id, created_at)
  WHERE approval_status = 'PENDING';
