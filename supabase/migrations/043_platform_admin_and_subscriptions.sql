-- =====================================================
-- MIGRACIÓN: Sistema de Super Admin y Suscripciones
-- Fecha: 2025-12-06
-- =====================================================

-- NOTA: Los roles 'sales' y 'support' se agregan en un script separado
-- porque ALTER TYPE ADD VALUE no puede estar en una transacción

-- 1. Crear enum para estados de suscripción
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Crear enum para planes
DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('trial', 'starter', 'professional', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 4. Agregar is_platform_admin a profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN DEFAULT FALSE;

-- 5. Agregar campos de suscripción a organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subscription_status subscription_status DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_plan subscription_plan DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- 6. Crear tabla de historial de suscripciones
CREATE TABLE IF NOT EXISTS subscription_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    plan subscription_plan NOT NULL,
    status subscription_status NOT NULL,
    amount DECIMAL(10,2),
    currency TEXT DEFAULT 'PEN',
    billing_period TEXT, -- 'monthly' or 'yearly'
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    payment_method TEXT,
    payment_reference TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subscription_history_org ON subscription_history(organization_id);

-- 7. Crear tabla de planes con precios
CREATE TABLE IF NOT EXISTS subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) NOT NULL,
    price_yearly DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'PEN',
    max_users INTEGER NOT NULL DEFAULT 3,
    max_contacts INTEGER NOT NULL DEFAULT 500,
    max_invoices_month INTEGER DEFAULT 100,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Insertar planes por defecto
INSERT INTO subscription_plans (name, display_name, description, price_monthly, price_yearly, max_users, max_contacts, max_invoices_month, features, sort_order)
VALUES 
    ('trial', 'Prueba Gratuita', '2 días de prueba con todas las funciones', 0, 0, 3, 100, 20, 
     '["Todas las funciones", "Soporte por email", "2 días de prueba"]', 0),
    ('starter', 'Starter', 'Ideal para emprendedores y pequeños negocios', 99, 999, 3, 500, 100,
     '["3 usuarios", "500 contactos", "100 facturas/mes", "Soporte por email", "Reportes básicos"]', 1),
    ('professional', 'Profesional', 'Para equipos de ventas en crecimiento', 199, 1999, 10, 2000, 500,
     '["10 usuarios", "2000 contactos", "500 facturas/mes", "Soporte prioritario", "Reportes avanzados", "Workflows ilimitados", "API access"]', 2),
    ('enterprise', 'Empresa', 'Solución completa para grandes equipos', 499, 4999, 50, 10000, -1,
     '["50 usuarios", "10000 contactos", "Facturas ilimitadas", "Soporte 24/7", "Reportes personalizados", "Integraciones avanzadas", "SLA garantizado"]', 3)
ON CONFLICT (name) DO UPDATE SET
    price_monthly = EXCLUDED.price_monthly,
    price_yearly = EXCLUDED.price_yearly,
    max_users = EXCLUDED.max_users,
    max_contacts = EXCLUDED.max_contacts;

-- 9. Crear tabla de permisos por rol
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role org_role NOT NULL,
    resource TEXT NOT NULL, -- 'contacts', 'invoices', 'opportunities', etc.
    can_create BOOLEAN DEFAULT FALSE,
    can_read BOOLEAN DEFAULT FALSE,
    can_update BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_read_all BOOLEAN DEFAULT FALSE, -- puede ver registros de otros usuarios
    can_manage_all BOOLEAN DEFAULT FALSE, -- puede editar registros de otros usuarios
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, resource)
);

-- 10. Insertar permisos por defecto
INSERT INTO role_permissions (role, resource, can_create, can_read, can_update, can_delete, can_read_all, can_manage_all)
VALUES
    -- OWNER: Todo
    ('owner', 'contacts', true, true, true, true, true, true),
    ('owner', 'opportunities', true, true, true, true, true, true),
    ('owner', 'invoices', true, true, true, true, true, true),
    ('owner', 'quotes', true, true, true, true, true, true),
    ('owner', 'tasks', true, true, true, true, true, true),
    ('owner', 'tickets', true, true, true, true, true, true),
    ('owner', 'products', true, true, true, true, true, true),
    ('owner', 'campaigns', true, true, true, true, true, true),
    ('owner', 'workflows', true, true, true, true, true, true),
    ('owner', 'settings', true, true, true, true, true, true),
    ('owner', 'users', true, true, true, true, true, true),
    ('owner', 'analytics', true, true, true, true, true, true),
    
    -- ADMIN: Casi todo excepto billing
    ('admin', 'contacts', true, true, true, true, true, true),
    ('admin', 'opportunities', true, true, true, true, true, true),
    ('admin', 'invoices', true, true, true, true, true, true),
    ('admin', 'quotes', true, true, true, true, true, true),
    ('admin', 'tasks', true, true, true, true, true, true),
    ('admin', 'tickets', true, true, true, true, true, true),
    ('admin', 'products', true, true, true, true, true, true),
    ('admin', 'campaigns', true, true, true, true, true, true),
    ('admin', 'workflows', true, true, true, true, true, true),
    ('admin', 'settings', true, true, true, false, true, true),
    ('admin', 'users', true, true, true, true, true, true),
    ('admin', 'analytics', true, true, true, true, true, true),
    
    -- MANAGER: Ve todo, gestiona equipo
    ('manager', 'contacts', true, true, true, true, true, true),
    ('manager', 'opportunities', true, true, true, true, true, true),
    ('manager', 'invoices', true, true, true, false, true, false),
    ('manager', 'quotes', true, true, true, true, true, true),
    ('manager', 'tasks', true, true, true, true, true, true),
    ('manager', 'tickets', true, true, true, false, true, false),
    ('manager', 'products', true, true, true, false, true, false),
    ('manager', 'campaigns', true, true, true, false, true, false),
    ('manager', 'workflows', false, true, false, false, true, false),
    ('manager', 'settings', false, true, false, false, false, false),
    ('manager', 'users', false, true, false, false, true, false),
    ('manager', 'analytics', false, true, false, false, true, false),
    
    -- MEMBER: Permisos básicos
    ('member', 'contacts', true, true, true, false, false, false),
    ('member', 'opportunities', true, true, true, false, false, false),
    ('member', 'invoices', true, true, false, false, false, false),
    ('member', 'quotes', true, true, true, false, false, false),
    ('member', 'tasks', true, true, true, true, false, false),
    ('member', 'tickets', false, true, false, false, false, false),
    ('member', 'products', false, true, false, false, true, false),
    ('member', 'campaigns', false, true, false, false, false, false),
    ('member', 'workflows', false, false, false, false, false, false),
    ('member', 'settings', false, false, false, false, false, false),
    ('member', 'users', false, false, false, false, false, false),
    ('member', 'analytics', false, true, false, false, false, false),
    
    -- VIEWER: Solo lectura
    ('viewer', 'contacts', false, true, false, false, true, false),
    ('viewer', 'opportunities', false, true, false, false, true, false),
    ('viewer', 'invoices', false, true, false, false, true, false),
    ('viewer', 'quotes', false, true, false, false, true, false),
    ('viewer', 'tasks', false, true, false, false, true, false),
    ('viewer', 'tickets', false, true, false, false, true, false),
    ('viewer', 'products', false, true, false, false, true, false),
    ('viewer', 'campaigns', false, true, false, false, true, false),
    ('viewer', 'workflows', false, true, false, false, true, false),
    ('viewer', 'settings', false, true, false, false, false, false),
    ('viewer', 'users', false, true, false, false, true, false),
    ('viewer', 'analytics', false, true, false, false, true, false)
ON CONFLICT (role, resource) DO NOTHING;

-- 11. Función para verificar si el trial expiró
CREATE OR REPLACE FUNCTION check_subscription_status(p_organization_id UUID)
RETURNS TABLE (
    is_active BOOLEAN,
    status subscription_status,
    days_remaining INTEGER,
    plan subscription_plan
) AS $$
DECLARE
    v_org organizations%ROWTYPE;
BEGIN
    SELECT * INTO v_org FROM organizations WHERE id = p_organization_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'expired'::subscription_status, 0, 'trial'::subscription_plan;
        RETURN;
    END IF;
    
    -- Si está en trial
    IF v_org.subscription_status = 'trial' THEN
        IF v_org.trial_ends_at IS NULL OR v_org.trial_ends_at > NOW() THEN
            RETURN QUERY SELECT 
                true, 
                'trial'::subscription_status, 
                COALESCE(EXTRACT(DAY FROM (v_org.trial_ends_at - NOW()))::INTEGER, 2),
                'trial'::subscription_plan;
        ELSE
            -- Trial expirado
            UPDATE organizations SET subscription_status = 'expired' WHERE id = p_organization_id;
            RETURN QUERY SELECT false, 'expired'::subscription_status, 0, 'trial'::subscription_plan;
        END IF;
        RETURN;
    END IF;
    
    -- Si tiene suscripción activa
    IF v_org.subscription_status = 'active' THEN
        IF v_org.subscription_ends_at IS NULL OR v_org.subscription_ends_at > NOW() THEN
            RETURN QUERY SELECT 
                true, 
                'active'::subscription_status,
                COALESCE(EXTRACT(DAY FROM (v_org.subscription_ends_at - NOW()))::INTEGER, 30),
                v_org.subscription_plan;
        ELSE
            -- Suscripción expirada
            UPDATE organizations SET subscription_status = 'expired' WHERE id = p_organization_id;
            RETURN QUERY SELECT false, 'expired'::subscription_status, 0, v_org.subscription_plan;
        END IF;
        RETURN;
    END IF;
    
    -- Otros estados (cancelled, expired, past_due)
    RETURN QUERY SELECT false, v_org.subscription_status, 0, v_org.subscription_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Función para crear organización con trial
CREATE OR REPLACE FUNCTION create_organization_with_trial(
    p_name TEXT,
    p_slug TEXT,
    p_owner_email TEXT,
    p_ruc TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_trial_days INTEGER DEFAULT 2
)
RETURNS TABLE (
    organization_id UUID,
    invitation_token TEXT
) AS $$
DECLARE
    v_org_id UUID;
    v_token TEXT;
BEGIN
    -- Crear organización
    INSERT INTO organizations (
        name, slug, ruc, 
        subscription_status, subscription_plan,
        trial_ends_at, created_by
    ) VALUES (
        p_name, p_slug, p_ruc,
        'trial', 'trial',
        NOW() + (p_trial_days || ' days')::INTERVAL, p_created_by
    ) RETURNING id INTO v_org_id;
    
    -- Crear invitación para el owner
    v_token := encode(gen_random_bytes(32), 'hex');
    
    INSERT INTO organization_invitations (
        organization_id, email, role, token, invited_by
    ) VALUES (
        v_org_id, p_owner_email, 'owner', v_token, p_created_by
    );
    
    -- Registrar en historial
    INSERT INTO subscription_history (
        organization_id, plan, status, started_at, notes, created_by
    ) VALUES (
        v_org_id, 'trial', 'trial', NOW(), 
        'Trial iniciado por ' || p_trial_days || ' días', p_created_by
    );
    
    RETURN QUERY SELECT v_org_id, v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Función para activar suscripción
CREATE OR REPLACE FUNCTION activate_subscription(
    p_organization_id UUID,
    p_plan subscription_plan,
    p_billing_period TEXT, -- 'monthly' or 'yearly'
    p_payment_reference TEXT DEFAULT NULL,
    p_activated_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_plan subscription_plans%ROWTYPE;
    v_end_date TIMESTAMPTZ;
    v_amount DECIMAL(10,2);
BEGIN
    -- Obtener plan
    SELECT * INTO v_plan FROM subscription_plans WHERE name = p_plan::TEXT;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Plan no encontrado: %', p_plan;
    END IF;
    
    -- Calcular fecha de fin y monto
    IF p_billing_period = 'yearly' THEN
        v_end_date := NOW() + INTERVAL '1 year';
        v_amount := v_plan.price_yearly;
    ELSE
        v_end_date := NOW() + INTERVAL '1 month';
        v_amount := v_plan.price_monthly;
    END IF;
    
    -- Actualizar organización
    UPDATE organizations SET
        subscription_status = 'active',
        subscription_plan = p_plan,
        subscription_ends_at = v_end_date,
        max_users = v_plan.max_users,
        max_contacts = v_plan.max_contacts,
        updated_at = NOW()
    WHERE id = p_organization_id;
    
    -- Registrar en historial
    INSERT INTO subscription_history (
        organization_id, plan, status, amount, billing_period,
        started_at, ended_at, payment_reference, created_by
    ) VALUES (
        p_organization_id, p_plan, 'active', v_amount, p_billing_period,
        NOW(), v_end_date, p_payment_reference, p_activated_by
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Índices adicionales
CREATE INDEX IF NOT EXISTS idx_profiles_platform_admin ON profiles(is_platform_admin) WHERE is_platform_admin = true;
CREATE INDEX IF NOT EXISTS idx_organizations_subscription ON organizations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends ON organizations(trial_ends_at) WHERE subscription_status = 'trial';

-- 15. RLS para subscription_history
ALTER TABLE subscription_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org subscription history" ON subscription_history
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Platform admins can manage all subscriptions" ON subscription_history
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
    );

-- 16. RLS para subscription_plans (público para lectura)
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON subscription_plans
    FOR SELECT USING (is_active = true);

CREATE POLICY "Platform admins can manage plans" ON subscription_plans
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_platform_admin = true)
    );

-- 17. RLS para role_permissions (público para lectura)
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permissions" ON role_permissions
    FOR SELECT USING (true);
