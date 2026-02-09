-- =====================================================
-- Tenant insert safety defaults (non-breaking hardening)
-- - Avoids 403/42501 cascades when API forgets organization_id
-- - Fills created_by automatically when possible
-- - Idempotent trigger recreation per table
-- =====================================================

-- For tables with organization_id + created_by
CREATE OR REPLACE FUNCTION set_tenant_defaults_org_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_id();
  END IF;

  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

-- For tables with organization_id only
CREATE OR REPLACE FUNCTION set_tenant_defaults_org_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := get_current_organization_id();
  END IF;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t TEXT;
BEGIN
  -- Tables that should default both organization_id and created_by
  FOREACH t IN ARRAY ARRAY[
    'contacts',
    'opportunities',
    'tasks',
    'products',
    'campaigns',
    'accounts',
    'tickets',
    'events',
    'quotes',
    'integrations',
    'workflows',
    'invoices',
    'payments',
    'notes',
    'activities',
    'documents',
    'sales_orders',
    'web_forms'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_defaults_%1$I ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_set_tenant_defaults_%1$I
         BEFORE INSERT ON public.%1$I
         FOR EACH ROW
         EXECUTE FUNCTION set_tenant_defaults_org_created_by()',
        t
      );
    END IF;
  END LOOP;

  -- Tables that only need organization_id default
  FOREACH t IN ARRAY ARRAY[
    'pipeline_stages',
    'lead_sources',
    'product_categories',
    'teams',
    'territories',
    'organization_settings',
    'notifications',
    'activity_logs',
    'form_submissions',
    'booking_configs',
    'calendar_events',
    'channels',
    'conversations',
    'messages',
    'favorites'
  ]
  LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_set_tenant_defaults_%1$I ON public.%1$I', t);
      EXECUTE format(
        'CREATE TRIGGER trg_set_tenant_defaults_%1$I
         BEFORE INSERT ON public.%1$I
         FOR EACH ROW
         EXECUTE FUNCTION set_tenant_defaults_org_only()',
        t
      );
    END IF;
  END LOOP;
END;
$$;
