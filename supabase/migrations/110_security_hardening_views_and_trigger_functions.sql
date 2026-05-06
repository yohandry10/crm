-- Close remaining dangerous privileges on public views and direct anonymous
-- execution of trigger-only encryption helpers.

DO $$
DECLARE
    object_name TEXT;
BEGIN
    FOR object_name IN
        SELECT quote_ident(n.nspname) || '.' || quote_ident(c.relname)
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relkind IN ('r', 'p', 'v', 'm')
    LOOP
        EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE %s FROM anon, authenticated', object_name);
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_encrypt_email_tokens() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_encrypt_integration_config() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_encrypt_organization_credentials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_encrypt_webhook_secret() FROM PUBLIC, anon, authenticated;

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
    'grants:no_dangerous_table_or_view_privileges'::TEXT,
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
  WITH sensitive(function_name) AS (
    VALUES
      ('encrypt_secret'::TEXT),
      ('decrypt_secret'::TEXT),
      ('upsert_organization_credentials'::TEXT),
      ('upsert_email_account_tokens'::TEXT),
      ('upsert_integration_config'::TEXT),
      ('process_payment_atomic'::TEXT),
      ('manual_reconcile_payment'::TEXT),
      ('auto_reconcile_payment'::TEXT),
      ('get_unreconciled_payments'::TEXT),
      ('decrement_stock'::TEXT),
      ('record_payment_atomic'::TEXT),
      ('check_quote_stock_availability'::TEXT),
      ('auto_encrypt_email_tokens'::TEXT),
      ('auto_encrypt_integration_config'::TEXT),
      ('auto_encrypt_organization_credentials'::TEXT),
      ('auto_encrypt_webhook_secret'::TEXT)
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
