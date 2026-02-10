-- =====================================================
-- Platform settings (global)
-- - Persist admin UI settings in DB (single row)
-- - Locked down to platform admins only via RLS
-- =====================================================

CREATE TABLE IF NOT EXISTS platform_settings (
  id INT PRIMARY KEY DEFAULT 1,
  default_trial_days INT NOT NULL DEFAULT 2,
  allow_self_signup BOOLEAN NOT NULL DEFAULT FALSE,
  require_email_verification BOOLEAN NOT NULL DEFAULT TRUE,
  maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
  stripe_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mercadopago_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_settings_single_row CHECK (id = 1)
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read/write platform settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Platform admins can view platform settings'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Platform admins can view platform settings" ON platform_settings
        FOR SELECT
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND is_platform_admin = true
          )
        )
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Platform admins can insert platform settings'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Platform admins can insert platform settings" ON platform_settings
        FOR INSERT
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND is_platform_admin = true
          )
        )
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'platform_settings' AND policyname = 'Platform admins can update platform settings'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Platform admins can update platform settings" ON platform_settings
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
              AND is_platform_admin = true
          )
        )
    $pol$;
  END IF;
END;
$$;

-- Ensure the single row exists.
INSERT INTO platform_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION set_platform_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_platform_settings_updated_at ON platform_settings;
CREATE TRIGGER trg_platform_settings_updated_at
BEFORE UPDATE ON platform_settings
FOR EACH ROW
EXECUTE FUNCTION set_platform_settings_updated_at();

