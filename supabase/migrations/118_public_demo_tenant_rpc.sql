-- =====================================================
-- Public demo tenant provisioning RPC
-- =====================================================
-- This function is intentionally public because the marketing/demo page uses
-- it to create isolated trial tenants. It never accepts user identifiers or
-- elevated permissions from the caller.

CREATE OR REPLACE FUNCTION public.create_demo_tenant(
  p_dias_duracion INTEGER DEFAULT 14,
  p_nombre TEXT DEFAULT 'Empresa Demo Operativa',
  p_pais_codigo TEXT DEFAULT 'PE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_account_id UUID;
  v_contact_id UUID;
  v_contact_2_id UUID;
  v_lead_source_id UUID;
  v_stage_id UUID;
  v_opportunity_id UUID;
  v_product_id UUID;
  v_product_2_id UUID;
  v_quote_id UUID;
  v_invoice_id UUID;
  v_form_id UUID;
  v_slug_base TEXT;
  v_slug TEXT;
  v_suffix TEXT;
  v_country_code TEXT;
  v_country_name TEXT;
  v_currency TEXT;
  v_trial_days INTEGER;
  v_expires_at TIMESTAMPTZ;
  v_recent_demo_count INTEGER;
BEGIN
  v_trial_days := LEAST(GREATEST(COALESCE(p_dias_duracion, 14), 1), 14);
  v_country_code := UPPER(LEFT(COALESCE(NULLIF(TRIM(p_pais_codigo), ''), 'PE'), 2));

  IF v_country_code = 'PE' THEN
    v_country_name := 'Perú';
    v_currency := 'PEN';
  ELSE
    v_country_name := v_country_code;
    v_currency := 'USD';
  END IF;

  SELECT COUNT(*)
  INTO v_recent_demo_count
  FROM public.organizations
  WHERE settings->>'demo_tenant' = 'true'
    AND created_at >= NOW() - INTERVAL '1 hour';

  IF v_recent_demo_count >= 60 THEN
    RAISE EXCEPTION 'Límite temporal de demos alcanzado. Intenta nuevamente más tarde.';
  END IF;

  v_suffix := LOWER(REPLACE(gen_random_uuid()::TEXT, '-', ''));
  v_suffix := LEFT(v_suffix, 8);
  v_slug_base := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(p_nombre), ''), 'empresa-demo'), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug_base := TRIM(BOTH '-' FROM v_slug_base);
  IF v_slug_base = '' THEN
    v_slug_base := 'empresa-demo';
  END IF;
  v_slug := LEFT('demo-' || v_slug_base, 42) || '-' || v_suffix;
  v_expires_at := NOW() + (v_trial_days || ' days')::INTERVAL;

  INSERT INTO public.organizations (
    name,
    slug,
    legal_name,
    industry,
    website,
    phone,
    email,
    address,
    city,
    country,
    timezone,
    currency,
    plan,
    max_users,
    max_contacts,
    subscription_status,
    subscription_plan,
    trial_ends_at,
    onboarding_completed,
    onboarding_completed_at,
    billing_email,
    billing_name,
    settings
  )
  VALUES (
    COALESCE(NULLIF(TRIM(p_nombre), ''), 'Empresa Demo Operativa'),
    v_slug,
    COALESCE(NULLIF(TRIM(p_nombre), ''), 'Empresa Demo Operativa') || ' S.A.C.',
    'Servicios empresariales',
    'https://demo.neonsystem.app',
    '+51 1 555 0100',
    'demo@neonsystem.app',
    'Av. Demo 123',
    CASE WHEN v_country_code = 'PE' THEN 'Lima' ELSE 'Ciudad Demo' END,
    v_country_name,
    CASE WHEN v_country_code = 'PE' THEN 'America/Lima' ELSE 'UTC' END,
    v_currency,
    'trial',
    5,
    500,
    'trial',
    'trial',
    v_expires_at,
    TRUE,
    NOW(),
    'demo@neonsystem.app',
    COALESCE(NULLIF(TRIM(p_nombre), ''), 'Empresa Demo Operativa'),
    jsonb_build_object(
      'demo_tenant', true,
      'country_code', v_country_code,
      'seed_version', 1,
      'created_by_rpc', 'create_demo_tenant'
    )
  )
  RETURNING id INTO v_org_id;

  -- The organization bootstrap trigger normally creates pipeline stages. Keep a
  -- defensive insert here in case the trigger is changed or disabled.
  IF NOT EXISTS (SELECT 1 FROM public.pipeline_stages WHERE organization_id = v_org_id) THEN
    INSERT INTO public.pipeline_stages (organization_id, name, position, win_probability, color, is_default, active)
    VALUES
      (v_org_id, 'Prospección', 1, 10,  '#64748b', TRUE,  TRUE),
      (v_org_id, 'Calificación', 2, 25, '#3b82f6', FALSE, TRUE),
      (v_org_id, 'Propuesta', 3, 50,    '#eab308', FALSE, TRUE),
      (v_org_id, 'Negociación', 4, 75,  '#f97316', FALSE, TRUE),
      (v_org_id, 'Ganado', 5, 100,      '#22c55e', FALSE, TRUE),
      (v_org_id, 'Perdido', 6, 0,       '#ef4444', FALSE, TRUE);
  END IF;

  SELECT id
  INTO v_stage_id
  FROM public.pipeline_stages
  WHERE organization_id = v_org_id
    AND active = TRUE
  ORDER BY position
  LIMIT 1;

  INSERT INTO public.lead_sources (organization_id, name, description, type, cost_per_lead, active)
  VALUES (v_org_id, 'Demo web', 'Leads iniciales de la demo pública', 'web', 0, TRUE)
  RETURNING id INTO v_lead_source_id;

  INSERT INTO public.accounts (
    organization_id, name, ruc, industry, website, phone, address, city, country, notes, metadata
  )
  VALUES (
    v_org_id,
    'Andes Retail S.A.C.',
    '20600000001',
    'Retail',
    'https://andes-retail.example',
    '+51 999 111 222',
    'Av. Javier Prado 1200',
    'Lima',
    v_country_name,
    'Cuenta demo con oportunidad y documentos asociados.',
    '{"demo": true}'::jsonb
  )
  RETURNING id INTO v_account_id;

  INSERT INTO public.contacts (
    organization_id, account_id, lead_source_id, name, email, phone, ruc, company, position,
    address, city, country, lead_score, lead_status, source, tags, notes, last_interaction,
    interactions_count, total_purchases, lead_score_factors, last_interaction_at
  )
  VALUES (
    v_org_id, v_account_id, v_lead_source_id, 'María Torres', 'maria.torres@example.com',
    '+51 999 333 444', '10400000001', 'Andes Retail S.A.C.', 'Gerente Comercial',
    'Av. Javier Prado 1200', 'Lima', v_country_name, 84, 'hot', 'Demo web',
    ARRAY['demo', 'retail', 'prioridad'], 'Interesada en paquete profesional.',
    NOW() - INTERVAL '1 day', 4, 1250,
    '{"fit": "high", "engagement": "high", "source": "demo"}'::jsonb,
    NOW() - INTERVAL '1 day'
  )
  RETURNING id INTO v_contact_id;

  INSERT INTO public.contacts (
    organization_id, account_id, lead_source_id, name, email, phone, company, position,
    city, country, lead_score, lead_status, source, tags, notes, last_interaction,
    interactions_count, total_purchases, lead_score_factors, last_interaction_at
  )
  VALUES (
    v_org_id, v_account_id, v_lead_source_id, 'Carlos Medina', 'carlos.medina@example.com',
    '+51 988 555 111', 'Andes Retail S.A.C.', 'Operaciones',
    'Lima', v_country_name, 57, 'warm', 'Demo web',
    ARRAY['demo', 'operaciones'], 'Solicitó revisión de inventario y facturación.',
    NOW() - INTERVAL '3 days', 2, 0,
    '{"fit": "medium", "engagement": "medium", "source": "demo"}'::jsonb,
    NOW() - INTERVAL '3 days'
  )
  RETURNING id INTO v_contact_2_id;

  INSERT INTO public.products (
    organization_id, sku, name, description, unit_price, cost_price, currency, tax_rate,
    is_service, is_active, stock_quantity, min_stock, metadata
  )
  VALUES (
    v_org_id, 'DEMO-SVC-' || v_suffix, 'Implementación CRM',
    'Servicio demo de implementación y parametrización.', 850, 250, v_currency,
    18, TRUE, TRUE, 0, 0, '{"demo": true}'::jsonb
  )
  RETURNING id INTO v_product_id;

  INSERT INTO public.products (
    organization_id, sku, name, description, unit_price, cost_price, currency, tax_rate,
    is_service, is_active, stock_quantity, min_stock, metadata
  )
  VALUES (
    v_org_id, 'DEMO-LIC-' || v_suffix, 'Licencia mensual profesional',
    'Suscripción mensual para equipo comercial.', 240, 80, v_currency,
    18, FALSE, TRUE, 25, 5, '{"demo": true}'::jsonb
  )
  RETURNING id INTO v_product_2_id;

  INSERT INTO public.opportunities (
    organization_id, contact_id, name, description, stage_id, status, expected_revenue,
    probability, expected_close_date, next_step
  )
  VALUES (
    v_org_id, v_contact_id, 'Implementación CRM - Andes Retail',
    'Oportunidad demo conectada a contacto, cotización y factura.',
    v_stage_id, 'open', 1250, 65, CURRENT_DATE + 14, 'Enviar propuesta final'
  )
  RETURNING id INTO v_opportunity_id;

  INSERT INTO public.quotes (
    organization_id, contact_id, opportunity_id, quote_number, status, total_amount,
    currency, valid_until, notes, terms
  )
  VALUES (
    v_org_id, v_contact_id, v_opportunity_id, 'COT-DEMO-' || v_suffix,
    'sent', 1250, v_currency, CURRENT_DATE + 10,
    'Cotización demo lista para conversión.',
    'Validez de 10 días. Precios incluyen impuestos cuando aplique.'
  )
  RETURNING id INTO v_quote_id;

  INSERT INTO public.quote_items (quote_id, product_id, description, quantity, unit_price, total)
  VALUES
    (v_quote_id, v_product_id, 'Implementación CRM', 1, 850, 850),
    (v_quote_id, v_product_2_id, 'Licencia mensual profesional', 1, 400, 400);

  INSERT INTO public.invoices (
    organization_id, contact_id, invoice_number, status, issue_date, due_date,
    currency, subtotal, tax, total, notes, series, correlative_number, quote_id
  )
  VALUES (
    v_org_id, v_contact_id, 'F001-DEMO-' || v_suffix, 'sent',
    CURRENT_DATE, CURRENT_DATE + 7, v_currency, 1059.32, 190.68, 1250,
    'Factura demo generada desde cotización.', 'F001', 1, v_quote_id
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, description, quantity, unit_price, total, tax_rate)
  VALUES
    (v_invoice_id, v_product_id, 'Implementación CRM', 1, 850, 850, 18),
    (v_invoice_id, v_product_2_id, 'Licencia mensual profesional', 1, 400, 400, 18);

  INSERT INTO public.payments (
    organization_id, contact_id, invoice_id, amount, currency, status, payment_method,
    transaction_id, gateway, metadata, paid_at, reconciliation_status, notes, payment_date
  )
  VALUES (
    v_org_id, v_contact_id, v_invoice_id, 500, v_currency, 'completed',
    'transferencia', 'DEMO-' || v_suffix, 'manual',
    '{"demo": true, "provider": "manual"}'::jsonb, NOW() - INTERVAL '6 hours',
    'partial', 'Pago parcial demo conciliado.', NOW() - INTERVAL '6 hours'
  );

  INSERT INTO public.tasks (
    organization_id, contact_id, title, description, status, priority, due_date, metadata
  )
  VALUES
    (v_org_id, v_contact_id, 'Llamar a María para cierre', 'Validar condiciones finales y fecha de inicio.', 'pending', 'high', NOW() + INTERVAL '1 day', '{"demo": true}'::jsonb),
    (v_org_id, v_contact_2_id, 'Enviar detalle de inventario', 'Compartir guía de kardex y stock mínimo.', 'in_progress', 'medium', NOW() + INTERVAL '2 days', '{"demo": true}'::jsonb);

  INSERT INTO public.campaigns (
    organization_id, name, description, type, status, target_segment, contact_count,
    subject, content, sent_count, delivered_count, opened_count, clicked_count,
    converted_count, budget, spent
  )
  VALUES (
    v_org_id, 'Reactivación clientes demo', 'Campaña demo para validar analítica comercial.',
    'email', 'active', '{"tags": ["demo"]}'::jsonb, 2,
    'Conoce las mejoras del CRM', 'Contenido demo para campaña de email.',
    2, 2, 1, 1, 0, 150, 20
  );

  INSERT INTO public.web_forms (
    organization_id, name, slug, description, fields, settings, default_tags,
    views_count, submissions_count
  )
  VALUES (
    v_org_id,
    'Formulario demo de contacto',
    'contacto-demo-' || v_suffix,
    'Formulario público de ejemplo conectado a contactos.',
    '[{"name":"name","label":"Nombre","type":"text","required":true},{"name":"email","label":"Email","type":"email","required":true},{"name":"message","label":"Mensaje","type":"textarea","required":false}]'::jsonb,
    '{"demo": true}'::jsonb,
    ARRAY['demo', 'formulario'],
    18,
    3
  )
  RETURNING id INTO v_form_id;

  INSERT INTO public.workflows (
    organization_id, name, description, trigger_type, trigger_conditions, actions, is_active, definition
  )
  VALUES (
    v_org_id,
    'Asignar lead caliente',
    'Workflow demo para crear tarea cuando entra un lead hot.',
    'contact.created',
    '{"lead_status": "hot"}'::jsonb,
    '[{"type":"create_task","title":"Contactar lead caliente","priority":"high"}]'::jsonb,
    TRUE,
    '{"demo": true, "version": 1}'::jsonb
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'organization_id', v_org_id,
    'tenant_id', v_org_id,
    'slug', v_slug,
    'country_code', v_country_code,
    'currency', v_currency,
    'expires_at', v_expires_at,
    'seed', jsonb_build_object(
      'accounts', 1,
      'contacts', 2,
      'products', 2,
      'opportunities', 1,
      'quotes', 1,
      'invoices', 1,
      'payments', 1,
      'tasks', 2,
      'campaigns', 1,
      'forms', 1,
      'workflows', 1
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_demo_tenant(INTEGER, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_demo_tenant(INTEGER, TEXT, TEXT) TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
