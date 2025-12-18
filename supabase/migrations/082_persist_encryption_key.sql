-- =====================================================
-- MIGRATION: Persist encryption key in Supabase (no custom GUC)
-- Purpose: Supabase Cloud blocks ALTER DATABASE/ROLE SET for custom params like app.encryption_key.
-- Approach: Store the encryption key in a locked-down schema/table and read it from SECURITY DEFINER
--           functions used by encrypt_secret()/decrypt_secret().
-- Notes:
-- - Keep the key consistent with your app ENCRYPTION_KEY.
-- - Do NOT expose the private schema/table to anon/authenticated.
-- =====================================================

-- 1) Private schema for secrets/config (no grants)
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA private FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;

ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- 2) Key/value store (single-row key: 'encryption_key')
CREATE TABLE IF NOT EXISTS private.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.app_settings FROM PUBLIC;

-- 3) Getter used by encryption functions
CREATE OR REPLACE FUNCTION private.get_app_encryption_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  k TEXT;
BEGIN
  SELECT value INTO k
  FROM private.app_settings
  WHERE key = 'encryption_key';

  IF k IS NULL OR k = '' THEN
    RAISE EXCEPTION 'Encryption key not configured. Set private.app_settings.key=encryption_key';
  END IF;

  RETURN k;
END;
$$;

REVOKE ALL ON FUNCTION private.get_app_encryption_key() FROM PUBLIC;

-- 4) Optional setter (admin only). Do not grant to authenticated.
CREATE OR REPLACE FUNCTION private.set_app_encryption_key(new_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF new_key IS NULL OR length(new_key) < 32 THEN
    RAISE EXCEPTION 'Encryption key must be at least 32 characters';
  END IF;

  INSERT INTO private.app_settings(key, value)
  VALUES ('encryption_key', new_key)
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION private.set_app_encryption_key(TEXT) FROM PUBLIC;

-- 5) Patch encrypt/decrypt to use private.get_app_encryption_key() instead of current_setting('app.encryption_key')
CREATE OR REPLACE FUNCTION encrypt_secret(secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  encryption_key := private.get_app_encryption_key();

  RETURN encode(
    pgp_sym_encrypt(
      secret,
      encryption_key,
      'cipher-algo=aes256'
    ),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_secret(encrypted_secret TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  encryption_key TEXT;
BEGIN
  IF encrypted_secret IS NULL THEN
    RETURN NULL;
  END IF;

  encryption_key := private.get_app_encryption_key();

  RETURN pgp_sym_decrypt(
    decode(encrypted_secret, 'base64'),
    encryption_key
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to decrypt secret: %', SQLERRM;
    RETURN NULL;
END;
$$;

