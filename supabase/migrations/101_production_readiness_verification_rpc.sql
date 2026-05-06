-- Production readiness verification RPC.
-- This exposes read-only catalog checks to the service role so CI/CD can
-- verify the target Supabase project after migrations are applied.

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
        ('103'::TEXT, '103_target_db_verification_fixes.sql'::TEXT)
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
      ('organizations'::TEXT),
      ('organization_members'::TEXT),
      ('profiles'::TEXT),
      ('contacts'::TEXT),
      ('accounts'::TEXT),
      ('opportunities'::TEXT),
      ('pipeline_stages'::TEXT),
      ('quotes'::TEXT),
      ('quote_items'::TEXT),
      ('invoices'::TEXT),
      ('invoice_items'::TEXT),
      ('payments'::TEXT),
      ('public_payment_tokens'::TEXT),
      ('products'::TEXT),
      ('sales_orders'::TEXT),
      ('tasks'::TEXT),
      ('tickets'::TEXT),
      ('conversations'::TEXT),
      ('messages'::TEXT),
      ('notifications'::TEXT),
      ('web_forms'::TEXT),
      ('form_submissions'::TEXT),
      ('calendar_events'::TEXT),
      ('workflows'::TEXT),
      ('workflow_executions'::TEXT),
      ('workflow_action_logs'::TEXT),
      ('analytics_cache'::TEXT),
      ('auditoria'::TEXT),
      ('integrations'::TEXT),
      ('webhook_events'::TEXT)
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
      ('record_payment_atomic'::TEXT),
      ('check_quote_stock_availability'::TEXT),
      ('decrement_stock'::TEXT),
      ('generate_payment_token'::TEXT),
      ('process_payment_atomic'::TEXT),
      ('get_unreconciled_payments'::TEXT),
      ('manual_reconcile_payment'::TEXT),
      ('encrypt_secret'::TEXT),
      ('decrypt_secret'::TEXT),
      ('upsert_organization_credentials'::TEXT),
      ('upsert_email_account_tokens'::TEXT),
      ('upsert_integration_config'::TEXT),
      ('search_contacts'::TEXT),
      ('find_duplicate_contacts'::TEXT),
      ('get_or_create_conversation'::TEXT),
      ('add_ai_message'::TEXT),
      ('check_subscription_status'::TEXT),
      ('check_plan_limits'::TEXT),
      ('get_workflow_execution_logs'::TEXT),
      ('cleanup_auditoria'::TEXT),
      ('cleanup_analytics_cache_ttl'::TEXT),
      ('cleanup_analytics_cache'::TEXT),
      ('expire_old_quotes'::TEXT),
      ('process_form_submission'::TEXT),
      ('increment_form_views'::TEXT),
      ('book_public_calendar_slot'::TEXT),
      ('create_invoice_with_items_atomic'::TEXT),
      ('verify_production_readiness'::TEXT)
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
    ),
    NULL::TEXT;

  RETURN QUERY
  SELECT
    'stripe_events_processing_contract'::TEXT,
    EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stripe_events'
        AND column_name = 'status'
    )
    AND EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'stripe_events'
        AND column_name = 'processing_started_at'
    ),
    NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_production_readiness() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_production_readiness() TO service_role;

COMMENT ON FUNCTION public.verify_production_readiness()
IS 'Read-only production readiness checks for CI/CD. Execute with service_role only.';
