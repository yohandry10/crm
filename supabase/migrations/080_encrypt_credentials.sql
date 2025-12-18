-- =====================================================
-- MIGRATION: Encrypt Sensitive Credentials
-- Enable pgcrypto extension and create encryption functions
-- Migrate existing data in organizations, email_accounts, integrations
-- =====================================================

-- 1. Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Create function to encrypt secrets
-- Uses AES-256 encryption in CBC mode with the encryption key from environment
CREATE OR REPLACE FUNCTION encrypt_secret(secret TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    -- Get encryption key from app settings or use a default (should be set via environment)
    -- In production, this should come from a secure vault
    encryption_key := current_setting('app.encryption_key', true);

    -- If encryption key is not set, raise an error
    IF encryption_key IS NULL OR encryption_key = '' THEN
        RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key';
    END IF;

    -- Return base64-encoded encrypted value
    -- Using pgp_sym_encrypt for symmetric encryption
    RETURN encode(
        pgp_sym_encrypt(
            secret,
            encryption_key,
            'cipher-algo=aes256'
        ),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create function to decrypt secrets
CREATE OR REPLACE FUNCTION decrypt_secret(encrypted_secret TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    -- Return NULL if input is NULL
    IF encrypted_secret IS NULL THEN
        RETURN NULL;
    END IF;

    -- Get encryption key
    encryption_key := current_setting('app.encryption_key', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
        RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key';
    END IF;

    -- Decrypt and return
    RETURN pgp_sym_decrypt(
        decode(encrypted_secret, 'base64'),
        encryption_key
    );
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return NULL for corrupted data
        RAISE WARNING 'Failed to decrypt secret: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add encrypted columns for organizations table
-- Keep original columns temporarily for migration
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS sunat_usuario_sol_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS sunat_clave_sol_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS ose_api_key_encrypted TEXT;

-- 5. Migrate existing organization data
-- Encrypt existing SUNAT credentials
UPDATE organizations
SET
    sunat_usuario_sol_encrypted = CASE
        WHEN sunat_usuario_sol IS NOT NULL AND sunat_usuario_sol != ''
        THEN encrypt_secret(sunat_usuario_sol)
        ELSE NULL
    END,
    sunat_clave_sol_encrypted = CASE
        WHEN sunat_clave_sol IS NOT NULL AND sunat_clave_sol != ''
        THEN encrypt_secret(sunat_clave_sol)
        ELSE NULL
    END,
    ose_api_key_encrypted = CASE
        WHEN ose_api_key IS NOT NULL AND ose_api_key != ''
        THEN encrypt_secret(ose_api_key)
        ELSE NULL
    END
WHERE sunat_usuario_sol IS NOT NULL
   OR sunat_clave_sol IS NOT NULL
   OR ose_api_key IS NOT NULL;

-- Clear plaintext columns after migration (keep encrypted as source of truth)
UPDATE organizations
SET
    sunat_usuario_sol = NULL,
    sunat_clave_sol = NULL,
    ose_api_key = NULL
WHERE sunat_usuario_sol IS NOT NULL
   OR sunat_clave_sol IS NOT NULL
   OR ose_api_key IS NOT NULL;

-- 6. Add encrypted columns for email_accounts table
ALTER TABLE email_accounts
    ADD COLUMN IF NOT EXISTS access_token_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token_encrypted TEXT;

-- 7. Migrate existing email account tokens
UPDATE email_accounts
SET
    access_token_encrypted = CASE
        WHEN access_token IS NOT NULL AND access_token != ''
        THEN encrypt_secret(access_token)
        ELSE NULL
    END,
    refresh_token_encrypted = CASE
        WHEN refresh_token IS NOT NULL AND refresh_token != ''
        THEN encrypt_secret(refresh_token)
        ELSE NULL
    END
WHERE access_token IS NOT NULL
   OR refresh_token IS NOT NULL;

-- Clear plaintext tokens after migration
UPDATE email_accounts
SET
    access_token = NULL,
    refresh_token = NULL
WHERE access_token IS NOT NULL
   OR refresh_token IS NOT NULL;

-- 8. Add encrypted config column for integrations table
ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS config_encrypted TEXT;

-- 9. Migrate existing integration configs
-- Encrypt entire config payload to avoid storing secrets in plaintext.
UPDATE integrations
SET config_encrypted = CASE
    WHEN config IS NOT NULL
    THEN encrypt_secret(config::text)
    ELSE NULL
END
WHERE config IS NOT NULL;

-- Clear plaintext integration config after migration
UPDATE integrations
SET config = NULL
WHERE config IS NOT NULL;

-- 10. Add encrypted secret column for webhooks table
ALTER TABLE webhooks
    ADD COLUMN IF NOT EXISTS secret_encrypted TEXT;

-- 11. Migrate existing webhook secrets
UPDATE webhooks
SET secret_encrypted = CASE
    WHEN secret IS NOT NULL AND secret != ''
    THEN encrypt_secret(secret)
    ELSE NULL
END
WHERE secret IS NOT NULL;

-- Clear plaintext secrets after migration
UPDATE webhooks
SET secret = NULL
WHERE secret IS NOT NULL;

-- 12. Create views for easy decryption (for application use)
-- These views automatically decrypt when accessed
CREATE OR REPLACE VIEW organizations_decrypted AS
SELECT
    id,
    name,
    legal_name,
    ruc,
    address,
    phone,
    email,
    timezone,
    currency,
    logo_url,
    -- Decrypt sensitive fields
    CASE
        WHEN sunat_usuario_sol_encrypted IS NOT NULL
        THEN decrypt_secret(sunat_usuario_sol_encrypted)
        ELSE sunat_usuario_sol
    END AS sunat_usuario_sol,
    CASE
        WHEN sunat_clave_sol_encrypted IS NOT NULL
        THEN decrypt_secret(sunat_clave_sol_encrypted)
        ELSE sunat_clave_sol
    END AS sunat_clave_sol,
    CASE
        WHEN ose_api_key_encrypted IS NOT NULL
        THEN decrypt_secret(ose_api_key_encrypted)
        ELSE ose_api_key
    END AS ose_api_key,
    certificado_digital,
    ose_provider,
    serie_factura,
    serie_boleta,
    serie_nota_credito,
    default_tax_rate,
    notify_new_lead,
    notify_task_due,
    notify_payment_received,
    notify_invoice_overdue,
    onboarding_completed,
    onboarding_completed_at,
    yape_phone,
    yape_qr_url,
    plin_phone,
    plin_qr_url,
    bank_name,
    bank_account,
    bank_cci,
    bank_holder,
    created_at,
    updated_at
FROM organizations;

-- Grant access to the view
GRANT SELECT ON organizations_decrypted TO authenticated;

-- 13. Create helper function to encrypt and insert organization credentials
CREATE OR REPLACE FUNCTION upsert_organization_credentials(
    org_id UUID,
    sunat_user TEXT DEFAULT NULL,
    sunat_pass TEXT DEFAULT NULL,
    ose_key TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE organizations
    SET
        sunat_usuario_sol_encrypted = CASE
            WHEN sunat_user IS NOT NULL
            THEN encrypt_secret(sunat_user)
            ELSE sunat_usuario_sol_encrypted
        END,
        sunat_clave_sol_encrypted = CASE
            WHEN sunat_pass IS NOT NULL
            THEN encrypt_secret(sunat_pass)
            ELSE sunat_clave_sol_encrypted
        END,
        ose_api_key_encrypted = CASE
            WHEN ose_key IS NOT NULL
            THEN encrypt_secret(ose_key)
            ELSE ose_api_key_encrypted
        END,
        updated_at = NOW()
    WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Create helper function to encrypt and insert email account tokens
CREATE OR REPLACE FUNCTION upsert_email_account_tokens(
    account_id UUID,
    access_tok TEXT DEFAULT NULL,
    refresh_tok TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE email_accounts
    SET
        access_token_encrypted = CASE
            WHEN access_tok IS NOT NULL
            THEN encrypt_secret(access_tok)
            ELSE access_token_encrypted
        END,
        refresh_token_encrypted = CASE
            WHEN refresh_tok IS NOT NULL
            THEN encrypt_secret(refresh_tok)
            ELSE refresh_token_encrypted
        END,
        updated_at = NOW()
    WHERE id = account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 15. Create helper function to encrypt and insert integration config
CREATE OR REPLACE FUNCTION upsert_integration_config(
    integration_id UUID,
    new_config JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE integrations
    SET
        config = NULL,
        config_encrypted = encrypt_secret(new_config::text),
        updated_at = NOW()
    WHERE id = integration_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 16. Add comments for documentation
COMMENT ON FUNCTION encrypt_secret(TEXT) IS 'Encrypts a secret using AES-256. Requires app.encryption_key to be set.';
COMMENT ON FUNCTION decrypt_secret(TEXT) IS 'Decrypts a secret encrypted with encrypt_secret(). Returns NULL on error.';
COMMENT ON FUNCTION upsert_organization_credentials(UUID, TEXT, TEXT, TEXT) IS 'Helper to securely update organization SUNAT/OSE credentials with encryption';
COMMENT ON FUNCTION upsert_email_account_tokens(UUID, TEXT, TEXT) IS 'Helper to securely update email account OAuth tokens with encryption';
COMMENT ON FUNCTION upsert_integration_config(UUID, JSONB) IS 'Helper to securely update integration config with encryption';

COMMENT ON COLUMN organizations.sunat_usuario_sol_encrypted IS 'Encrypted SUNAT SOL username';
COMMENT ON COLUMN organizations.sunat_clave_sol_encrypted IS 'Encrypted SUNAT SOL password';
COMMENT ON COLUMN organizations.ose_api_key_encrypted IS 'Encrypted OSE API key';
COMMENT ON COLUMN email_accounts.access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN email_accounts.refresh_token_encrypted IS 'Encrypted OAuth refresh token';
COMMENT ON COLUMN integrations.config_encrypted IS 'Encrypted integration configuration (contains API keys, secrets)';
COMMENT ON COLUMN webhooks.secret_encrypted IS 'Encrypted webhook secret for signature verification';

-- 17. Create trigger to auto-encrypt on insert/update for organizations
CREATE OR REPLACE FUNCTION auto_encrypt_organization_credentials()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt SUNAT credentials if provided in plain text
    IF NEW.sunat_usuario_sol IS NOT NULL AND NEW.sunat_usuario_sol != ''
       AND (NEW.sunat_usuario_sol_encrypted IS NULL OR OLD.sunat_usuario_sol IS DISTINCT FROM NEW.sunat_usuario_sol) THEN
        NEW.sunat_usuario_sol_encrypted := encrypt_secret(NEW.sunat_usuario_sol);
        NEW.sunat_usuario_sol := NULL; -- Clear plain text
    END IF;

    IF NEW.sunat_clave_sol IS NOT NULL AND NEW.sunat_clave_sol != ''
       AND (NEW.sunat_clave_sol_encrypted IS NULL OR OLD.sunat_clave_sol IS DISTINCT FROM NEW.sunat_clave_sol) THEN
        NEW.sunat_clave_sol_encrypted := encrypt_secret(NEW.sunat_clave_sol);
        NEW.sunat_clave_sol := NULL; -- Clear plain text
    END IF;

    IF NEW.ose_api_key IS NOT NULL AND NEW.ose_api_key != ''
       AND (NEW.ose_api_key_encrypted IS NULL OR OLD.ose_api_key IS DISTINCT FROM NEW.ose_api_key) THEN
        NEW.ose_api_key_encrypted := encrypt_secret(NEW.ose_api_key);
        NEW.ose_api_key := NULL; -- Clear plain text
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_organization_credentials ON organizations;
CREATE TRIGGER encrypt_organization_credentials
    BEFORE INSERT OR UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION auto_encrypt_organization_credentials();

-- 18. Create trigger to auto-encrypt email account tokens
CREATE OR REPLACE FUNCTION auto_encrypt_email_tokens()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.access_token IS NOT NULL AND NEW.access_token != ''
       AND (NEW.access_token_encrypted IS NULL OR OLD.access_token IS DISTINCT FROM NEW.access_token) THEN
        NEW.access_token_encrypted := encrypt_secret(NEW.access_token);
        NEW.access_token := NULL;
    END IF;

    IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token != ''
       AND (NEW.refresh_token_encrypted IS NULL OR OLD.refresh_token IS DISTINCT FROM NEW.refresh_token) THEN
        NEW.refresh_token_encrypted := encrypt_secret(NEW.refresh_token);
        NEW.refresh_token := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_email_tokens ON email_accounts;
CREATE TRIGGER encrypt_email_tokens
    BEFORE INSERT OR UPDATE ON email_accounts
    FOR EACH ROW
    EXECUTE FUNCTION auto_encrypt_email_tokens();

-- 19. Create trigger to auto-encrypt integration config
CREATE OR REPLACE FUNCTION auto_encrypt_integration_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Encrypt any provided config and clear plaintext column.
    IF NEW.config IS NOT NULL
       AND (NEW.config_encrypted IS NULL OR OLD.config IS DISTINCT FROM NEW.config) THEN
        NEW.config_encrypted := encrypt_secret(NEW.config::text);
        NEW.config := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_integration_config ON integrations;
CREATE TRIGGER encrypt_integration_config
    BEFORE INSERT OR UPDATE ON integrations
    FOR EACH ROW
    EXECUTE FUNCTION auto_encrypt_integration_config();

-- 20. Create trigger to auto-encrypt webhook secrets
CREATE OR REPLACE FUNCTION auto_encrypt_webhook_secret()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.secret IS NOT NULL AND NEW.secret != ''
       AND (NEW.secret_encrypted IS NULL OR OLD.secret IS DISTINCT FROM NEW.secret) THEN
        NEW.secret_encrypted := encrypt_secret(NEW.secret);
        NEW.secret := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS encrypt_webhook_secret ON webhooks;
CREATE TRIGGER encrypt_webhook_secret
    BEFORE INSERT OR UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION auto_encrypt_webhook_secret();

-- =====================================================
-- IMPORTANT NOTES:
-- =====================================================
-- 1. Set the encryption key before running migrations:
--    ALTER DATABASE postgres SET app.encryption_key = 'your-secure-key-here';
--
-- 2. Or set it per session:
--    SET app.encryption_key = 'your-secure-key-here';
--
-- 3. In production, use a strong 32+ character encryption key
--    stored in a secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)
--
-- 4. After verifying encrypted data is working correctly, you can:
--    - Drop the original plaintext columns (sunat_usuario_sol, sunat_clave_sol, etc.)
--    - Keep encrypted columns as the source of truth
--
-- 5. The triggers will automatically encrypt data on insert/update
--    and clear the plaintext columns
--
-- 6. Use the helper functions or application code to handle encryption
--    instead of direct column access
-- =====================================================
