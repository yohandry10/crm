-- Production readiness verification.
-- Run this in the target Supabase SQL editor after applying migrations 094-101.
-- It is read-only: every result row should return pass = true before go-live.
-- CI/CD can run the same checks through:
--   pnpm production:verify-db

select
  'schema_migrations_table_exists' as check_name,
  to_regclass('supabase_migrations.schema_migrations') is not null as pass;

with required(version, file_name) as (
  values
    ('094', '094_atomic_manual_payments.sql'),
    ('095', '095_security_definer_hardening.sql'),
    ('096', '096_stripe_event_processing_status.sql'),
    ('097', '097_security_definer_rpc_hardening.sql'),
    ('098', '098_atomic_public_booking.sql'),
    ('099', '099_public_payment_tokens_hardening.sql'),
    ('100', '100_revenue_inventory_consistency.sql'),
    ('101', '101_production_readiness_verification_rpc.sql')
)
select
  'migration_applied:' || required.file_name as check_name,
  exists (
    select 1
    from supabase_migrations.schema_migrations applied
    where applied.version = required.version
  ) as pass
from required
order by required.version;

with required(table_name) as (
  values
    ('organizations'),
    ('organization_members'),
    ('profiles'),
    ('contacts'),
    ('accounts'),
    ('opportunities'),
    ('pipeline_stages'),
    ('quotes'),
    ('quote_items'),
    ('invoices'),
    ('invoice_items'),
    ('payments'),
    ('public_payment_tokens'),
    ('products'),
    ('sales_orders'),
    ('tasks'),
    ('tickets'),
    ('conversations'),
    ('messages'),
    ('notifications'),
    ('web_forms'),
    ('form_submissions'),
    ('calendar_events'),
    ('workflows'),
    ('workflow_executions'),
    ('workflow_action_logs'),
    ('analytics_cache'),
    ('auditoria'),
    ('integrations'),
    ('webhook_events')
),
rls as (
  select c.relname as table_name, c.relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
)
select
  'rls_enabled:' || required.table_name as check_name,
  coalesce(rls.relrowsecurity, false) as pass
from required
left join rls on rls.table_name = required.table_name
order by required.table_name;

with required(function_name) as (
  values
    ('record_payment_atomic'),
    ('check_quote_stock_availability'),
    ('decrement_stock'),
    ('generate_payment_token'),
    ('process_payment_atomic'),
    ('get_unreconciled_payments'),
    ('manual_reconcile_payment'),
    ('encrypt_secret'),
    ('decrypt_secret'),
    ('upsert_organization_credentials'),
    ('upsert_email_account_tokens'),
    ('upsert_integration_config'),
    ('search_contacts'),
    ('find_duplicate_contacts'),
    ('get_or_create_conversation'),
    ('add_ai_message'),
    ('check_subscription_status'),
    ('check_plan_limits'),
    ('get_workflow_execution_logs'),
    ('cleanup_auditoria'),
    ('cleanup_analytics_cache_ttl'),
    ('cleanup_analytics_cache'),
    ('expire_old_quotes'),
    ('process_form_submission'),
    ('increment_form_views'),
    ('book_public_calendar_slot'),
    ('create_invoice_with_items_atomic'),
    ('verify_production_readiness')
),
functions as (
  select p.proname as function_name, bool_or(p.prosecdef) as has_security_definer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
  group by p.proname
)
select
  'function_exists:' || required.function_name as check_name,
  functions.function_name is not null as pass
from required
left join functions on functions.function_name = required.function_name
order by required.function_name;

select
  'organizations_decrypted_not_public' as check_name,
  not has_table_privilege('authenticated', 'public.organizations_decrypted', 'SELECT')
  and not has_table_privilege('anon', 'public.organizations_decrypted', 'SELECT') as pass
where to_regclass('public.organizations_decrypted') is not null;

select
  'public_payment_tokens_shape' as check_name,
  exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'public_payment_tokens'
      and constraint_name = 'public_payment_tokens_single_resource_check'
  ) as pass;

select
  'invoice_items_product_contract' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoice_items'
      and column_name = 'product_id'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'invoice_items'
      and column_name = 'tax_rate'
  ) as pass;

select
  'sales_orders_items_contract' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_orders'
      and column_name = 'items'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sales_orders'
      and column_name = 'order_number'
  )
  and exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'sales_orders'
      and constraint_name = 'sales_orders_items_array_check'
  ) as pass;

select
  'stripe_events_processing_contract' as check_name,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_events'
      and column_name = 'status'
  )
  and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'stripe_events'
      and column_name = 'processing_started_at'
  ) as pass;
