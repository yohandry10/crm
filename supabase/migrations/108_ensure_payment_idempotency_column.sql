-- Ensure the deployed database matches the manual payment RPC contract.
-- record_payment_atomic reads/writes payments.idempotency_key.

ALTER TABLE payments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
ON payments(organization_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key_created
ON payments(organization_id, idempotency_key, created_at)
WHERE idempotency_key IS NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_idempotency_key_format'
          AND conrelid = 'payments'::regclass
    ) THEN
        ALTER TABLE payments
        ADD CONSTRAINT chk_idempotency_key_format
        CHECK (
            idempotency_key IS NULL OR
            (length(idempotency_key) >= 16 AND length(idempotency_key) <= 255)
        );
    END IF;
END;
$$;
