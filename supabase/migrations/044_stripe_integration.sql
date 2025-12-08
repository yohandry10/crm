-- =====================================================
-- MIGRACIÓN: Integración Stripe y Mejoras de Suscripción
-- Fecha: 2025-12-06
-- =====================================================

-- 1. Agregar campos de Stripe a organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS billing_email TEXT,
ADD COLUMN IF NOT EXISTS billing_name TEXT,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- 2. Crear índices para búsqueda rápida por Stripe IDs
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_subscription ON organizations(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;

-- 3. Agregar stripe_price_id a subscription_plans
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS stripe_price_id_monthly TEXT,
ADD COLUMN IF NOT EXISTS stripe_price_id_yearly TEXT;

-- 4. Tabla de eventos de Stripe (para idempotencia de webhooks)
CREATE TABLE IF NOT EXISTS stripe_events (
    id TEXT PRIMARY KEY, -- Stripe event ID
    type TEXT NOT NULL,
    data JSONB NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_created ON stripe_events(created_at);

-- 5. Tabla de pagos/invoices de Stripe
CREATE TABLE IF NOT EXISTS stripe_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_invoice_id TEXT UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    stripe_customer_id TEXT NOT NULL,
    stripe_subscription_id TEXT,
    amount_paid INTEGER NOT NULL, -- en centavos
    currency TEXT DEFAULT 'pen',
    status TEXT NOT NULL, -- paid, open, void, uncollectible
    invoice_pdf TEXT,
    hosted_invoice_url TEXT,
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_org ON stripe_invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_status ON stripe_invoices(status);

-- 6. Tabla de logs de auditoría para admin
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_user_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL, -- 'create_org', 'activate_subscription', 'cancel_subscription', etc.
    target_type TEXT NOT NULL, -- 'organization', 'subscription', 'user'
    target_id UUID,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at);

-- 7. Tabla de notificaciones de sistema
CREATE TABLE IF NOT EXISTS system_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'trial_expiring', 'payment_failed', 'subscription_cancelled', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    read_at TIMESTAMPTZ,
    sent_email_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_org ON system_notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON system_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON system_notifications(user_id) WHERE read_at IS NULL;

-- 8. Función para procesar webhook de Stripe checkout.session.completed
CREATE OR REPLACE FUNCTION process_stripe_checkout_completed(
    p_stripe_customer_id TEXT,
    p_stripe_subscription_id TEXT,
    p_organization_id UUID,
    p_plan TEXT,
    p_billing_period TEXT,
    p_amount INTEGER,
    p_current_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE organizations SET
        stripe_customer_id = p_stripe_customer_id,
        stripe_subscription_id = p_stripe_subscription_id,
        subscription_status = 'active',
        subscription_plan = p_plan::subscription_plan,
        subscription_ends_at = p_current_period_end,
        current_period_end = p_current_period_end,
        updated_at = NOW()
    WHERE id = p_organization_id;

    -- Registrar en historial
    INSERT INTO subscription_history (
        organization_id, plan, status, amount, billing_period,
        started_at, ended_at, payment_reference
    ) VALUES (
        p_organization_id, p_plan::subscription_plan, 'active', 
        p_amount / 100.0, p_billing_period,
        NOW(), p_current_period_end, p_stripe_subscription_id
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Función para procesar webhook invoice.paid
CREATE OR REPLACE FUNCTION process_stripe_invoice_paid(
    p_stripe_invoice_id TEXT,
    p_stripe_customer_id TEXT,
    p_stripe_subscription_id TEXT,
    p_amount_paid INTEGER,
    p_currency TEXT,
    p_invoice_pdf TEXT,
    p_hosted_invoice_url TEXT,
    p_period_start TIMESTAMPTZ,
    p_period_end TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Encontrar organización por customer_id
    SELECT id INTO v_org_id FROM organizations WHERE stripe_customer_id = p_stripe_customer_id;
    
    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Insertar invoice
    INSERT INTO stripe_invoices (
        stripe_invoice_id, organization_id, stripe_customer_id, stripe_subscription_id,
        amount_paid, currency, status, invoice_pdf, hosted_invoice_url,
        period_start, period_end, paid_at
    ) VALUES (
        p_stripe_invoice_id, v_org_id, p_stripe_customer_id, p_stripe_subscription_id,
        p_amount_paid, p_currency, 'paid', p_invoice_pdf, p_hosted_invoice_url,
        p_period_start, p_period_end, NOW()
    ) ON CONFLICT (stripe_invoice_id) DO UPDATE SET
        status = 'paid',
        paid_at = NOW();

    -- Actualizar período de suscripción
    UPDATE organizations SET
        subscription_status = 'active',
        current_period_start = p_period_start,
        current_period_end = p_period_end,
        subscription_ends_at = p_period_end,
        updated_at = NOW()
    WHERE id = v_org_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Función para procesar webhook invoice.payment_failed
CREATE OR REPLACE FUNCTION process_stripe_payment_failed(
    p_stripe_customer_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM organizations WHERE stripe_customer_id = p_stripe_customer_id;
    
    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Marcar como past_due
    UPDATE organizations SET
        subscription_status = 'past_due',
        updated_at = NOW()
    WHERE id = v_org_id;

    -- Crear notificación
    INSERT INTO system_notifications (
        organization_id, type, title, message
    ) VALUES (
        v_org_id, 'payment_failed', 
        'Pago fallido',
        'No pudimos procesar tu pago. Por favor actualiza tu método de pago para evitar la suspensión del servicio.'
    );

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Función para procesar webhook customer.subscription.deleted
CREATE OR REPLACE FUNCTION process_stripe_subscription_cancelled(
    p_stripe_subscription_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_org_id UUID;
BEGIN
    SELECT id INTO v_org_id FROM organizations WHERE stripe_subscription_id = p_stripe_subscription_id;
    
    IF v_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    UPDATE organizations SET
        subscription_status = 'cancelled',
        stripe_subscription_id = NULL,
        updated_at = NOW()
    WHERE id = v_org_id;

    -- Registrar en historial
    INSERT INTO subscription_history (
        organization_id, plan, status, started_at, notes
    ) SELECT 
        id, subscription_plan, 'cancelled', NOW(), 'Suscripción cancelada'
    FROM organizations WHERE id = v_org_id;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Función para verificar límites del plan
CREATE OR REPLACE FUNCTION check_plan_limits(
    p_organization_id UUID,
    p_resource TEXT, -- 'users', 'contacts', 'invoices'
    p_current_count INTEGER DEFAULT NULL
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INTEGER,
    max_allowed INTEGER,
    plan_name TEXT
) AS $$
DECLARE
    v_org organizations%ROWTYPE;
    v_plan subscription_plans%ROWTYPE;
    v_count INTEGER;
    v_max INTEGER;
BEGIN
    SELECT * INTO v_org FROM organizations WHERE id = p_organization_id;
    SELECT * INTO v_plan FROM subscription_plans WHERE name = v_org.subscription_plan::TEXT;

    -- Obtener conteo actual si no se proporciona
    IF p_current_count IS NULL THEN
        CASE p_resource
            WHEN 'users' THEN
                SELECT COUNT(*) INTO v_count FROM organization_members 
                WHERE organization_id = p_organization_id AND is_active = true;
            WHEN 'contacts' THEN
                SELECT COUNT(*) INTO v_count FROM contacts 
                WHERE organization_id = p_organization_id;
            WHEN 'invoices' THEN
                SELECT COUNT(*) INTO v_count FROM invoices 
                WHERE organization_id = p_organization_id 
                AND created_at >= date_trunc('month', NOW());
            ELSE
                v_count := 0;
        END CASE;
    ELSE
        v_count := p_current_count;
    END IF;

    -- Obtener límite según recurso
    CASE p_resource
        WHEN 'users' THEN v_max := COALESCE(v_org.max_users, v_plan.max_users, 3);
        WHEN 'contacts' THEN v_max := COALESCE(v_org.max_contacts, v_plan.max_contacts, 500);
        WHEN 'invoices' THEN v_max := COALESCE(v_plan.max_invoices_month, 100);
        ELSE v_max := 999999;
    END CASE;

    -- -1 significa ilimitado
    IF v_max = -1 THEN
        RETURN QUERY SELECT true, v_count, v_max, v_plan.name;
    ELSE
        RETURN QUERY SELECT (v_count < v_max), v_count, v_max, v_plan.name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. RLS para nuevas tablas
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_notifications ENABLE ROW LEVEL SECURITY;

-- Solo platform admins pueden ver eventos de Stripe
CREATE POLICY "Platform admins can view stripe events" ON stripe_events
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
    );

-- Usuarios pueden ver invoices de su organización
CREATE POLICY "Users can view their org invoices" ON stripe_invoices
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Solo platform admins pueden ver audit logs
CREATE POLICY "Platform admins can view audit logs" ON admin_audit_logs
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
    );

-- Usuarios pueden ver sus notificaciones
CREATE POLICY "Users can view their notifications" ON system_notifications
    FOR SELECT USING (
        user_id = auth.uid() OR
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Users can update their notifications" ON system_notifications
    FOR UPDATE USING (user_id = auth.uid());

-- 14. Función para crear notificación de trial expirando
CREATE OR REPLACE FUNCTION notify_trial_expiring()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
    v_org RECORD;
BEGIN
    -- Buscar organizaciones con trial que expira en 1 día
    FOR v_org IN 
        SELECT o.id, o.name, om.user_id
        FROM organizations o
        JOIN organization_members om ON om.organization_id = o.id AND om.role = 'owner'
        WHERE o.subscription_status = 'trial'
        AND o.trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '1 day'
        AND NOT EXISTS (
            SELECT 1 FROM system_notifications sn 
            WHERE sn.organization_id = o.id 
            AND sn.type = 'trial_expiring'
            AND sn.created_at > NOW() - INTERVAL '1 day'
        )
    LOOP
        INSERT INTO system_notifications (
            organization_id, user_id, type, title, message
        ) VALUES (
            v_org.id, v_org.user_id, 'trial_expiring',
            '¡Tu prueba expira mañana!',
            'Tu período de prueba de ' || v_org.name || ' expira mañana. Suscríbete ahora para no perder acceso.'
        );
        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

