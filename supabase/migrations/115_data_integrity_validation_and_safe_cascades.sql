-- Data integrity audit and safer delete behavior for business history.

ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_contact_id_fkey,
  ADD CONSTRAINT activities_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.interactions
  DROP CONSTRAINT IF EXISTS interactions_contact_id_fkey,
  ADD CONSTRAINT interactions_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_contact_id_fkey,
  ADD CONSTRAINT tasks_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.workflow_executions
  DROP CONSTRAINT IF EXISTS workflow_executions_contact_id_fkey,
  ADD CONSTRAINT workflow_executions_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;

ALTER TABLE public.workflow_executions
  DROP CONSTRAINT IF EXISTS workflow_executions_workflow_id_fkey,
  ADD CONSTRAINT workflow_executions_workflow_id_fkey
    FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE SET NULL;

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_product_fk,
  ADD CONSTRAINT inventory_movements_product_fk
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL;

ALTER TABLE public.opportunities
  DROP CONSTRAINT IF EXISTS opportunities_contact_id_fkey,
  ADD CONSTRAINT opportunities_contact_id_fkey
    FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;

CREATE OR REPLACE FUNCTION public.verify_data_integrity()
RETURNS TABLE(check_name TEXT, pass BOOLEAN, details TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  fk RECORD;
  fk_issue_count BIGINT;
BEGIN
  FOR fk IN
    SELECT
      c.conname,
      c.conrelid::regclass AS child_table,
      c.confrelid::regclass AS parent_table,
      child_att.attname AS child_column,
      parent_att.attname AS parent_column
    FROM pg_constraint c
    JOIN pg_attribute child_att
      ON child_att.attrelid = c.conrelid
      AND child_att.attnum = c.conkey[1]
    JOIN pg_attribute parent_att
      ON parent_att.attrelid = c.confrelid
      AND parent_att.attnum = c.confkey[1]
    WHERE c.contype = 'f'
      AND c.connamespace = 'public'::regnamespace
      AND array_length(c.conkey, 1) = 1
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s child LEFT JOIN %s parent ON child.%I = parent.%I WHERE child.%I IS NOT NULL AND parent.%I IS NULL',
      fk.child_table,
      fk.parent_table,
      fk.child_column,
      fk.parent_column,
      fk.child_column,
      fk.parent_column
    )
    INTO fk_issue_count;

    RETURN QUERY
    SELECT
      ('fk_orphans:' || fk.conname)::TEXT,
      fk_issue_count = 0,
      CASE WHEN fk_issue_count = 0 THEN NULL ELSE fk_issue_count || ' orphan row(s)' END::TEXT;
  END LOOP;

  RETURN QUERY
  SELECT
    'fk_constraints_validated'::TEXT,
    NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace
        AND NOT convalidated
    ),
    NULL::TEXT;

  RETURN QUERY
  WITH dangerous AS (
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS parent_table,
      tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON rc.constraint_name = tc.constraint_name
      AND rc.constraint_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND rc.delete_rule = 'CASCADE'
      AND ccu.table_name <> 'organizations'
      AND tc.table_name NOT IN (
        'ai_messages',
        'campaign_contacts',
        'form_submissions',
        'invoice_items',
        'messages',
        'opportunity_products',
        'organization_invitations',
        'organization_members',
        'public_payment_tokens',
        'quote_items',
        'team_members',
        'webhook_deliveries',
        'workflow_action_logs'
      )
  )
  SELECT
    'dangerous_cascades'::TEXT,
    count(*) = 0,
    CASE
      WHEN count(*) = 0 THEN NULL
      ELSE string_agg(table_name || '.' || column_name || ' -> ' || parent_table || ' (' || constraint_name || ')', '; ')
    END::TEXT
  FROM dangerous;

  RETURN QUERY
  WITH checks(name, issue_count) AS (
    SELECT 'duplicate_active_members', count(*) FROM (
      SELECT organization_id, user_id
      FROM organization_members
      WHERE is_active
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_contact_email_per_org', count(*) FROM (
      SELECT organization_id, lower(trim(email))
      FROM contacts
      WHERE nullif(trim(email), '') IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_account_ruc_per_org', count(*) FROM (
      SELECT organization_id, trim(ruc)
      FROM accounts
      WHERE nullif(trim(ruc), '') IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_product_sku_per_org', count(*) FROM (
      SELECT organization_id, lower(trim(sku))
      FROM products
      WHERE nullif(trim(sku), '') IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_invoice_number_per_org', count(*) FROM (
      SELECT organization_id, invoice_number
      FROM invoices
      WHERE invoice_number IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_quote_number_per_org', count(*) FROM (
      SELECT organization_id, quote_number
      FROM quotes
      WHERE quote_number IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_form_slug_per_org', count(*) FROM (
      SELECT organization_id, slug
      FROM web_forms
      WHERE slug IS NOT NULL
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_stage_position_per_org', count(*) FROM (
      SELECT organization_id, position
      FROM pipeline_stages
      WHERE active
      GROUP BY 1, 2
      HAVING count(*) > 1
    ) x
    UNION ALL SELECT 'duplicate_payment_tx_per_gateway', count(*) FROM (
      SELECT organization_id, gateway, transaction_id
      FROM payments
      WHERE transaction_id IS NOT NULL
      GROUP BY 1, 2, 3
      HAVING count(*) > 1
    ) x
  )
  SELECT
    name::TEXT,
    checks.issue_count = 0,
    CASE WHEN checks.issue_count = 0 THEN NULL ELSE checks.issue_count || ' duplicate group(s)' END::TEXT
  FROM checks;

  RETURN QUERY
  WITH checks(name, issue_count) AS (
    SELECT 'contact_account_cross_tenant', count(*) FROM contacts c JOIN accounts a ON a.id = c.account_id WHERE c.account_id IS NOT NULL AND c.organization_id <> a.organization_id
    UNION ALL SELECT 'contact_campaign_cross_tenant', count(*) FROM contacts c JOIN campaigns p ON p.id = c.campaign_id WHERE c.campaign_id IS NOT NULL AND c.organization_id <> p.organization_id
    UNION ALL SELECT 'contact_lead_source_cross_tenant', count(*) FROM contacts c JOIN lead_sources l ON l.id = c.lead_source_id WHERE c.lead_source_id IS NOT NULL AND c.organization_id <> l.organization_id
    UNION ALL SELECT 'opportunity_contact_cross_tenant', count(*) FROM opportunities o JOIN contacts c ON c.id = o.contact_id WHERE o.organization_id <> c.organization_id
    UNION ALL SELECT 'opportunity_stage_cross_tenant', count(*) FROM opportunities o JOIN pipeline_stages s ON s.id = o.stage_id WHERE o.stage_id IS NOT NULL AND o.organization_id <> s.organization_id
    UNION ALL SELECT 'quote_contact_cross_tenant', count(*) FROM quotes q JOIN contacts c ON c.id = q.contact_id WHERE q.contact_id IS NOT NULL AND q.organization_id <> c.organization_id
    UNION ALL SELECT 'quote_opportunity_cross_tenant', count(*) FROM quotes q JOIN opportunities o ON o.id = q.opportunity_id WHERE q.opportunity_id IS NOT NULL AND q.organization_id <> o.organization_id
    UNION ALL SELECT 'invoice_contact_cross_tenant', count(*) FROM invoices i JOIN contacts c ON c.id = i.contact_id WHERE i.contact_id IS NOT NULL AND i.organization_id <> c.organization_id
    UNION ALL SELECT 'invoice_quote_cross_tenant', count(*) FROM invoices i JOIN quotes q ON q.id = i.quote_id WHERE i.quote_id IS NOT NULL AND i.organization_id <> q.organization_id
    UNION ALL SELECT 'quote_item_product_cross_tenant', count(*) FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id JOIN products p ON p.id = qi.product_id WHERE qi.product_id IS NOT NULL AND q.organization_id <> p.organization_id
    UNION ALL SELECT 'invoice_item_product_cross_tenant', count(*) FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id JOIN products p ON p.id = ii.product_id WHERE ii.product_id IS NOT NULL AND i.organization_id <> p.organization_id
    UNION ALL SELECT 'payment_invoice_cross_tenant', count(*) FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE p.invoice_id IS NOT NULL AND p.organization_id <> i.organization_id
    UNION ALL SELECT 'payment_contact_cross_tenant', count(*) FROM payments p JOIN contacts c ON c.id = p.contact_id WHERE p.contact_id IS NOT NULL AND p.organization_id <> c.organization_id
    UNION ALL SELECT 'task_contact_cross_tenant', count(*) FROM tasks t JOIN contacts c ON c.id = t.contact_id WHERE t.contact_id IS NOT NULL AND t.organization_id <> c.organization_id
    UNION ALL SELECT 'task_workflow_cross_tenant', count(*) FROM tasks t JOIN workflows w ON w.id = t.workflow_id WHERE t.workflow_id IS NOT NULL AND t.organization_id <> w.organization_id
    UNION ALL SELECT 'ticket_account_cross_tenant', count(*) FROM tickets t JOIN accounts a ON a.id = t.account_id WHERE t.account_id IS NOT NULL AND t.organization_id <> a.organization_id
    UNION ALL SELECT 'ticket_contact_cross_tenant', count(*) FROM tickets t JOIN contacts c ON c.id = t.contact_id WHERE t.contact_id IS NOT NULL AND t.organization_id <> c.organization_id
    UNION ALL SELECT 'calendar_contact_cross_tenant', count(*) FROM calendar_events e JOIN contacts c ON c.id = e.contact_id WHERE e.contact_id IS NOT NULL AND e.organization_id <> c.organization_id
    UNION ALL SELECT 'calendar_opportunity_cross_tenant', count(*) FROM calendar_events e JOIN opportunities o ON o.id = e.opportunity_id WHERE e.opportunity_id IS NOT NULL AND e.organization_id <> o.organization_id
    UNION ALL SELECT 'sales_order_account_cross_tenant', count(*) FROM sales_orders so JOIN accounts a ON a.id = so.account_id WHERE so.account_id IS NOT NULL AND so.organization_id <> a.organization_id
    UNION ALL SELECT 'sales_order_contact_cross_tenant', count(*) FROM sales_orders so JOIN contacts c ON c.id = so.contact_id WHERE so.contact_id IS NOT NULL AND so.organization_id <> c.organization_id
    UNION ALL SELECT 'sales_order_opportunity_cross_tenant', count(*) FROM sales_orders so JOIN opportunities o ON o.id = so.opportunity_id WHERE so.opportunity_id IS NOT NULL AND so.organization_id <> o.organization_id
    UNION ALL SELECT 'payment_token_invoice_cross_tenant', count(*) FROM public_payment_tokens t JOIN invoices i ON i.id = t.invoice_id WHERE t.invoice_id IS NOT NULL AND t.organization_id <> i.organization_id
    UNION ALL SELECT 'payment_token_quote_cross_tenant', count(*) FROM public_payment_tokens t JOIN quotes q ON q.id = t.quote_id WHERE t.quote_id IS NOT NULL AND t.organization_id <> q.organization_id
    UNION ALL SELECT 'campaign_contact_cross_tenant', count(*) FROM campaign_contacts cc JOIN campaigns ca ON ca.id = cc.campaign_id JOIN contacts c ON c.id = cc.contact_id WHERE ca.organization_id <> c.organization_id
    UNION ALL SELECT 'inventory_movement_product_cross_tenant', count(*) FROM inventory_movements im JOIN products p ON p.id = im.product_id WHERE im.product_id IS NOT NULL AND im.organization_id <> p.organization_id
  )
  SELECT
    name::TEXT,
    checks.issue_count = 0,
    CASE WHEN checks.issue_count = 0 THEN NULL ELSE checks.issue_count || ' cross-tenant row(s)' END::TEXT
  FROM checks;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_data_integrity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_data_integrity() TO service_role;

COMMENT ON FUNCTION public.verify_data_integrity()
IS 'Read-only data integrity checks: FK orphans, dangerous cascades, duplicate business keys, and multi-tenant consistency. Execute with service_role only.';
