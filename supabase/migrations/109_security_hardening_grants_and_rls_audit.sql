-- Production security hardening for direct database access.
-- RLS remains the main tenant boundary, but anon/authenticated roles should not
-- keep dangerous table privileges or execute sensitive SECURITY DEFINER RPCs.

-- 1. Remove privileges that bypass or weaken normal row-level access patterns.
DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOR table_name IN
        SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p')
    LOOP
        EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM anon, authenticated', table_name);
    END LOOP;
END;
$$;

-- 2. Lock down internal/system tables more tightly than generic CRUD grants.
REVOKE ALL ON TABLE public.auditoria FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.auditoria FROM authenticated;
GRANT SELECT, INSERT ON TABLE public.auditoria TO authenticated;

REVOKE ALL ON TABLE public.system_health FROM anon;
REVOKE ALL ON TABLE public.system_health FROM authenticated;
GRANT SELECT ON TABLE public.system_health TO authenticated;

REVOKE ALL ON TABLE public.webhook_events FROM anon;
REVOKE ALL ON TABLE public.webhook_events FROM authenticated;
GRANT SELECT ON TABLE public.webhook_events TO authenticated;

REVOKE ALL ON TABLE public.role_permissions FROM anon;
REVOKE ALL ON TABLE public.role_permissions FROM authenticated;
GRANT SELECT ON TABLE public.role_permissions TO authenticated;

-- 3. Remove anonymous/default execution from sensitive SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.encrypt_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrypt_secret(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_organization_credentials(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_email_account_tokens(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.upsert_integration_config(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_payment_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manual_reconcile_payment(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_reconcile_payment(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_unreconciled_payments(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrement_stock(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_quote_stock_availability(UUID) FROM PUBLIC, anon, authenticated;

-- Explicit grants needed by authenticated API routes.
GRANT EXECUTE ON FUNCTION public.record_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_quote_stock_availability(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unreconciled_payments(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.manual_reconcile_payment(UUID, UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock(UUID, INTEGER) TO authenticated;

-- 4. Keep public RPC entry points intentional.
GRANT EXECUTE ON FUNCTION public.process_form_submission(UUID, JSONB, INET, TEXT, TEXT, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_form_views(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.book_public_calendar_slot(UUID, TIMESTAMPTZ, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

-- 5. Verifier used by production DB checks.
CREATE OR REPLACE FUNCTION public.verify_security_hardening()
RETURNS TABLE (
    check_name TEXT,
    pass BOOLEAN,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    'grants:no_dangerous_table_privileges'::TEXT,
    NOT EXISTS (
      SELECT 1
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('anon', 'authenticated')
        AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    ),
    (
      SELECT string_agg(table_name || ':' || grantee || ':' || privilege_type, ', ')
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee IN ('anon', 'authenticated')
        AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')
    )::TEXT;

  RETURN QUERY
  WITH sensitive(function_name, args) AS (
    VALUES
      ('encrypt_secret'::TEXT, 'text'::TEXT),
      ('decrypt_secret'::TEXT, 'text'::TEXT),
      ('upsert_organization_credentials'::TEXT, 'uuid, text, text, text'::TEXT),
      ('upsert_email_account_tokens'::TEXT, 'uuid, text, text'::TEXT),
      ('upsert_integration_config'::TEXT, 'uuid, jsonb'::TEXT),
      ('process_payment_atomic'::TEXT, 'uuid, uuid, numeric, text, text, text, uuid'::TEXT),
      ('manual_reconcile_payment'::TEXT, 'uuid, uuid, uuid, text'::TEXT),
      ('auto_reconcile_payment'::TEXT, 'uuid'::TEXT),
      ('get_unreconciled_payments'::TEXT, 'uuid'::TEXT),
      ('decrement_stock'::TEXT, 'uuid, integer'::TEXT),
      ('record_payment_atomic'::TEXT, 'uuid, uuid, uuid, numeric, text, text, text, text, text, text, text'::TEXT),
      ('check_quote_stock_availability'::TEXT, 'uuid'::TEXT)
  ),
  exposed AS (
    SELECT sensitive.function_name
    FROM sensitive
    JOIN pg_proc p ON p.proname = sensitive.function_name
    JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
    WHERE has_function_privilege('anon', p.oid, 'EXECUTE')
       OR has_function_privilege('public', p.oid, 'EXECUTE')
  )
  SELECT
    'rpc:no_anon_sensitive_security_definer_execute'::TEXT,
    NOT EXISTS (SELECT 1 FROM exposed),
    (SELECT string_agg(function_name, ', ') FROM exposed)::TEXT;

  RETURN QUERY
  SELECT
    'rpc:security_definer_search_path_set'::TEXT,
    NOT EXISTS (
      SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND (
          p.proconfig IS NULL OR NOT EXISTS (
            SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
          )
        )
    ),
    NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_security_hardening() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_security_hardening() TO service_role;

COMMENT ON FUNCTION public.verify_security_hardening()
IS 'Read-only security hardening checks for table grants and SECURITY DEFINER RPC exposure.';
