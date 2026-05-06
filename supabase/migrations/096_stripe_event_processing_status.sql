-- Stripe webhook idempotency hardening
-- Events are claimed as processing first and marked processed only after side effects finish.

ALTER TABLE stripe_events
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE stripe_events
  ALTER COLUMN processed_at DROP DEFAULT;

UPDATE stripe_events
SET
  status = COALESCE(status, 'processed'),
  processing_started_at = COALESCE(processing_started_at, created_at),
  processed_at = COALESCE(processed_at, created_at)
WHERE status IS NULL;

ALTER TABLE stripe_events
  ALTER COLUMN status SET DEFAULT 'processing',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE stripe_events
  DROP CONSTRAINT IF EXISTS stripe_events_status_check;

ALTER TABLE stripe_events
  ADD CONSTRAINT stripe_events_status_check
  CHECK (status IN ('processing', 'processed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_stripe_events_status_created
  ON stripe_events(status, created_at);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processing_started
  ON stripe_events(processing_started_at)
  WHERE status = 'processing';
