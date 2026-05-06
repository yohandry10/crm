-- Webhook secrets are stored in secret_encrypted after credential hardening.
-- Keep the legacy plaintext column nullable so inserts can avoid storing secrets in plain text.
ALTER TABLE webhooks
    ALTER COLUMN secret DROP NOT NULL;
