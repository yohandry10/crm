-- Tenant provisioning and schema alignment hardening.
-- Business contract: platform admins provision organizations; regular users
-- operate inside organizations where they have an active membership.

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings"
ON public.user_settings
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

REVOKE ALL ON public.user_settings FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.user_settings FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;
REVOKE INSERT ON public.organizations FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_production_readiness()
RETURNS TABLE(check_name TEXT, pass BOOLEAN, details TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'schema_migrations_table_exists'::TEXT,
    to_regclass('supabase_migrations.schema_migrations') IS NOT NULL,
    NULL::TEXT;

  IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
    RETURN QUERY
    WITH required(version, file_name) AS (
      VALUES
        ('094'::TEXT, '094_atomic_manual_payments.sql'::TEXT),
        ('095'::TEXT, '095_security_definer_hardening.sql'::TEXT),
        ('096'::TEXT, '096_stripe_event_processing_status.sql'::TEXT),
        ('097'::TEXT, '097_security_definer_rpc_hardening.sql'::TEXT),
        ('098'::TEXT, '098_atomic_public_booking.sql'::TEXT),
        ('099'::TEXT, '099_public_payment_tokens_hardening.sql'::TEXT),
        ('100'::TEXT, '100_revenue_inventory_consistency.sql'::TEXT),
        ('101'::TEXT, '101_production_readiness_verification_rpc.sql'::TEXT),
        ('102'::TEXT, '102_payment_provider_settings.sql'::TEXT),
        ('103'::TEXT, '103_target_db_verification_fixes.sql'::TEXT),
        ('104'::TEXT, '104_remove_legacy_stripe_artifacts.sql'::TEXT),
        ('105'::TEXT, '105_webhook_secret_nullable.sql'::TEXT),
        ('106'::TEXT, '106_fix_invoice_free_items.sql'::TEXT),
        ('107'::TEXT, '107_add_payment_role_permissions.sql'::TEXT),
        ('108'::TEXT, '108_ensure_payment_idempotency_column.sql'::TEXT),
        ('109'::TEXT, '109_security_hardening_grants_and_rls_audit.sql'::TEXT),
        ('110'::TEXT, '110_security_hardening_views_and_trigger_functions.sql'::TEXT),
        ('111'::TEXT, '111_webhook_events_authenticated_insert_policy.sql'::TEXT),
        ('112'::TEXT, '112_tenant_provisioning_and_schema_alignment.sql'::TEXT)
    )
    SELECT
      ('migration_applied:' || required.file_name)::TEXT,
      EXISTS (
        SELECT 1
        FROM supabase_migrations.schema_migrations applied
        WHERE applied.version = required.version
      ),
      NULL::TEXT
    FROM required
    ORDER BY required.version;
  ELSE
    RETURN QUERY
    SELECT
      'migration_applied:all'::TEXT,
      FALSE,
      'supabase_migrations.schema_migrations is missing'::TEXT;
  END IF;

  RETURN QUERY
  WITH required(table_name) AS (
    VALUES
      ('accounts'::TEXT),
      ('activities'::TEXT),
      ('activity_logs'::TEXT),
      ('admin_audit_logs'::TEXT),
      ('ai_conversations'::TEXT),
      ('ai_messages'::TEXT),
      ('analytics_cache'::TEXT),
      ('auditoria'::TEXT),
      ('booking_configs'::TEXT),
      ('calendar_events'::TEXT),
      ('campaigns'::TEXT),
      ('comprobantes_electronicos'::TEXT),
      ('contacts'::TEXT),
      ('conversations'::TEXT),
      ('email_accounts'::TEXT),
      ('favorites'::TEXT),
      ('form_submissions'::TEXT),
      ('integrations'::TEXT),
      ('inventory_movements'::TEXT),
      ('invoice_items'::TEXT),
      ('invoices'::TEXT),
      ('lead_sources'::TEXT),
      ('messages'::TEXT),
      ('notes'::TEXT),
      ('notifications'::TEXT),
      ('opportunities'::TEXT),
      ('organization_invitations'::TEXT),
      ('organization_members'::TEXT),
      ('organizations'::TEXT),
      ('payments'::TEXT),
      ('pipeline_stages'::TEXT),
      ('platform_settings'::TEXT),
      ('products'::TEXT),
      ('profiles'::TEXT),
      ('public_payment_tokens'::TEXT),
      ('quote_items'::TEXT),
      ('quotes'::TEXT),
      ('role_permissions'::TEXT),
      ('sales_orders'::TEXT),
      ('saved_reports'::TEXT),
      ('subscription_history'::TEXT),
      ('subscription_plans'::TEXT),
      ('synced_emails'::TEXT),
      ('system_notifications'::TEXT),
      ('tasks'::TEXT),
      ('tickets'::TEXT),
      ('user_settings'::TEXT),
      ('web_forms'::TEXT),
      ('webhook_deliveries'::TEXT),
      ('webhook_events'::TEXT),
      ('webhooks'::TEXT),
      ('whatsapp_messages'::TEXT),
      ('workflow_action_logs'::TEXT),
      ('workflow_executions'::TEXT),
      ('workflows'::TEXT)
  ),
  rls AS (
    SELECT c.relname::TEXT AS table_name, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  )
  SELECT
    ('rls_enabled:' || required.table_name)::TEXT,
    COALESCE(rls.relrowsecurity, FALSE),
    CASE WHEN rls.table_name IS NULL THEN 'table missing' ELSE NULL END::TEXT
  FROM required
  LEFT JOIN rls ON rls.table_name = required.table_name
  ORDER BY required.table_name;

  RETURN QUERY
  WITH required(function_name) AS (
    VALUES
      ('accept_organization_invitation'::TEXT),
      ('activate_subscription'::TEXT),
      ('add_ai_message'::TEXT),
      ('book_public_calendar_slot'::TEXT),
      ('check_plan_limits'::TEXT),
      ('check_quote_stock_availability'::TEXT),
      ('cleanup_analytics_cache'::TEXT),
      ('cleanup_analytics_cache_ttl'::TEXT),
      ('cleanup_auditoria'::TEXT),
      ('create_invoice_with_items_atomic'::TEXT),
      ('create_organization_with_trial'::TEXT),
      ('decrement_stock'::TEXT),
      ('expire_old_quotes'::TEXT),
      ('generate_payment_token'::TEXT),
      ('get_or_create_conversation'::TEXT),
      ('get_unreconciled_payments'::TEXT),
      ('get_workflow_execution_logs'::TEXT),
      ('increment_form_views'::TEXT),
      ('manual_reconcile_payment'::TEXT),
      ('record_payment_atomic'::TEXT),
      ('search_contacts'::TEXT),
      ('verify_production_readiness'::TEXT),
      ('verify_security_hardening'::TEXT)
  ),
  functions AS (
    SELECT p.proname::TEXT AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    GROUP BY p.proname
  )
  SELECT
    ('function_exists:' || required.function_name)::TEXT,
    functions.function_name IS NOT NULL,
    CASE WHEN functions.function_name IS NULL THEN 'function missing' ELSE NULL END::TEXT
  FROM required
  LEFT JOIN functions ON functions.function_name = required.function_name
  ORDER BY required.function_name;

  RETURN QUERY
  SELECT
    'organizations_decrypted_not_public'::TEXT,
    CASE
      WHEN to_regclass('public.organizations_decrypted') IS NULL THEN TRUE
      ELSE NOT has_table_privilege('authenticated', 'public.organizations_decrypted', 'SELECT')
        AND NOT has_table_privilege('anon', 'public.organizations_decrypted', 'SELECT')
    END,
    CASE
      WHEN to_regclass('public.organizations_decrypted') IS NULL THEN 'view absent'
      ELSE NULL
    END::TEXT;

  RETURN QUERY
  SELECT
    'organization_self_service_insert_disabled'::TEXT,
    NOT has_table_privilege('authenticated', 'public.organizations', 'INSERT')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'organizations'
        AND policyname = 'Authenticated users can create organizations'
    ),
    NULL::TEXT;

  RETURN QUERY
  SELECT
    'user_settings_contract'::TEXT,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_settings'
        AND column_name = 'user_id'
    )
    AND EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'user_settings'
        AND policyname = 'Users can manage own settings'
    ),
    NULL::TEXT;

  RETURN QUERY
  SELECT
    'public_payment_tokens_shape'::TEXT,
    EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'public_payment_tokens'
        AND constraint_name = 'public_payment_tokens_single_resource_check'
    ),
    NULL::TEXT;

  RETURN QUERY
  SELECT
    'invoice_items_product_contract'::TEXT,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoice_items'
        AND column_name = 'product_id'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'invoice_items'
        AND column_name = 'tax_rate'
    ),
    NULL::TEXT;

  RETURN QUERY
  SELECT
    'sales_orders_items_contract'::TEXT,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sales_orders'
        AND column_name = 'items'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'sales_orders'
        AND column_name = 'order_number'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'sales_orders'
        AND constraint_name = 'sales_orders_items_array_check'
    ),
    NULL::TEXT;

  RETURN QUERY
  SELECT
    'payment_provider_settings_contract'::TEXT,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'platform_settings'
        AND column_name = 'culqi_enabled'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'platform_settings'
        AND column_name = 'pagoefectivo_enabled'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'platform_settings'
        AND column_name IN ('stripe_enabled', 'mercadopago_enabled')
    ),
    NULL::TEXT;

  RETURN QUERY
  WITH legacy_artifacts(name, present) AS (
    VALUES
      ('table:stripe_events'::TEXT, to_regclass('public.stripe_events') IS NOT NULL),
      ('table:stripe_invoices'::TEXT, to_regclass('public.stripe_invoices') IS NOT NULL),
      (
        'columns:organizations_stripe'::TEXT,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'organizations'
            AND column_name IN ('stripe_customer_id', 'stripe_subscription_id', 'stripe_price_id')
        )
      ),
      (
        'columns:subscription_plans_stripe'::TEXT,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'subscription_plans'
            AND column_name IN ('stripe_price_id_monthly', 'stripe_price_id_yearly')
        )
      ),
      (
        'functions:process_stripe'::TEXT,
        EXISTS (
          SELECT 1
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = 'public'
            AND p.proname LIKE 'process_stripe_%'
        )
      )
  )
  SELECT
    'legacy_stripe_artifacts_removed'::TEXT,
    NOT COALESCE(bool_or(legacy_artifacts.present), FALSE),
    string_agg(legacy_artifacts.name, ', ') FILTER (WHERE legacy_artifacts.present)::TEXT
  FROM legacy_artifacts;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_production_readiness() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_production_readiness() TO service_role;

COMMENT ON FUNCTION public.verify_production_readiness()
IS 'Read-only production readiness checks for CI/CD. Execute with service_role only.';
