-- =====================================================
-- COMPLETE CRM MODULES (MULTI-TENANT)
-- =====================================================

-- ===== 1. PRODUCTOS Y SERVICIOS =====
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    sku TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID,
    unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
    cost_price DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'PEN',
    tax_rate DECIMAL(5,2) DEFAULT 18.00,
    is_service BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    stock_quantity INTEGER DEFAULT 0,
    min_stock INTEGER DEFAULT 0,
    image_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES product_categories(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_products_org ON products(organization_id);
CREATE INDEX idx_products_org_active ON products(organization_id, is_active) WHERE is_active;
CREATE INDEX idx_product_categories_org ON product_categories(organization_id);

-- ===== 2. COMPROBANTES ELECTRÓNICOS SUNAT =====
CREATE TYPE documento_tipo AS ENUM ('factura', 'boleta', 'nota_credito', 'nota_debito', 'guia_remision');
CREATE TYPE documento_estado AS ENUM ('borrador', 'emitido', 'enviado_sunat', 'aceptado', 'rechazado', 'anulado');

CREATE TABLE IF NOT EXISTS comprobantes_electronicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id),
    tipo documento_tipo NOT NULL,
    serie TEXT NOT NULL,
    numero INTEGER NOT NULL,
    fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
    fecha_vencimiento DATE,
    cliente_tipo_doc TEXT NOT NULL,
    cliente_num_doc TEXT NOT NULL,
    cliente_nombre TEXT NOT NULL,
    cliente_direccion TEXT,
    moneda TEXT DEFAULT 'PEN',
    subtotal DECIMAL(12,2) NOT NULL,
    igv DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    estado documento_estado DEFAULT 'borrador',
    hash_cpe TEXT,
    codigo_sunat TEXT,
    mensaje_sunat TEXT,
    xml_firmado TEXT,
    cdr_xml TEXT,
    pdf_url TEXT,
    ose_provider TEXT,
    ose_ticket TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, tipo, serie, numero)
);

CREATE INDEX idx_comprobantes_org ON comprobantes_electronicos(organization_id);

-- ===== 3. CAMPAÑAS DE MARKETING =====
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled');
CREATE TYPE campaign_type AS ENUM ('email', 'whatsapp', 'sms', 'mixed');

CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    type campaign_type NOT NULL,
    status campaign_status DEFAULT 'draft',
    target_segment JSONB,
    contact_count INTEGER DEFAULT 0,
    subject TEXT,
    content TEXT,
    template_id UUID,
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    opened_count INTEGER DEFAULT 0,
    clicked_count INTEGER DEFAULT 0,
    converted_count INTEGER DEFAULT 0,
    bounced_count INTEGER DEFAULT 0,
    unsubscribed_count INTEGER DEFAULT 0,
    budget DECIMAL(10,2) DEFAULT 0,
    spent DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    converted_at TIMESTAMPTZ,
    error_message TEXT,
    UNIQUE(campaign_id, contact_id)
);

CREATE INDEX idx_campaigns_org ON campaigns(organization_id);

-- ===== 4. LEAD SOURCES =====
CREATE TABLE IF NOT EXISTS lead_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT,
    cost_per_lead DECIMAL(10,2) DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lead_sources_org ON lead_sources(organization_id);

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source_id UUID REFERENCES lead_sources(id);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id);

-- ===== 5. EQUIPOS Y TERRITORIOS =====
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    manager_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member',
    sales_quota DECIMAL(12,2) DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE TABLE IF NOT EXISTS territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    regions TEXT[],
    assigned_team_id UUID REFERENCES teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_org ON teams(organization_id);
CREATE INDEX idx_territories_org ON territories(organization_id);

-- ===== 6. DOCUMENTOS =====
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    opportunity_id UUID,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size INTEGER,
    category TEXT,
    is_template BOOLEAN DEFAULT FALSE,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_documents_org ON documents(organization_id);

-- ===== 7. NOTIFICACIONES =====
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error', 'reminder');
CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push', 'whatsapp', 'sms');

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type notification_type DEFAULT 'info',
    channel notification_channel DEFAULT 'in_app',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_url TEXT,
    related_type TEXT,
    related_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_org ON notifications(organization_id);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE NOT is_read;

-- ===== 8. CONFIGURACIÓN DE ORGANIZACIÓN =====
CREATE TABLE IF NOT EXISTS organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
    sunat_usuario_sol TEXT,
    sunat_clave_sol TEXT,
    certificado_digital TEXT,
    ose_provider TEXT,
    ose_api_key TEXT,
    serie_factura TEXT DEFAULT 'F001',
    serie_boleta TEXT DEFAULT 'B001',
    serie_nota_credito TEXT DEFAULT 'FC01',
    default_currency TEXT DEFAULT 'PEN',
    default_tax_rate DECIMAL(5,2) DEFAULT 18.00,
    notify_new_lead BOOLEAN DEFAULT TRUE,
    notify_task_due BOOLEAN DEFAULT TRUE,
    notify_payment_received BOOLEAN DEFAULT TRUE,
    notify_invoice_overdue BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== 9. ACTIVIDADES =====
CREATE TABLE IF NOT EXISTS activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    activity_type TEXT NOT NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    opportunity_id UUID,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    subject TEXT,
    description TEXT,
    outcome TEXT,
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    next_action TEXT,
    next_action_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activities_org ON activities(organization_id);
CREATE INDEX idx_activities_contact ON activities(contact_id);

-- ===== 10. METAS DE VENTAS =====
CREATE TABLE IF NOT EXISTS sales_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id),
    team_id UUID REFERENCES teams(id),
    period_type TEXT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    revenue_goal DECIMAL(12,2) DEFAULT 0,
    deals_goal INTEGER DEFAULT 0,
    leads_goal INTEGER DEFAULT 0,
    revenue_actual DECIMAL(12,2) DEFAULT 0,
    deals_actual INTEGER DEFAULT 0,
    leads_actual INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_goals_org ON sales_goals(organization_id);

-- ===== RLS POLICIES =====
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE comprobantes_electronicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_goals ENABLE ROW LEVEL SECURITY;

-- PRODUCTS
CREATE POLICY "Org members can view products" ON products FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert products" ON products FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update products" ON products FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete products" ON products FOR DELETE USING (is_org_member(organization_id));

-- PRODUCT CATEGORIES
CREATE POLICY "Org members can view categories" ON product_categories FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert categories" ON product_categories FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update categories" ON product_categories FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete categories" ON product_categories FOR DELETE USING (is_org_member(organization_id));

-- COMPROBANTES ELECTRONICOS
CREATE POLICY "Org members can view comprobantes" ON comprobantes_electronicos FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert comprobantes" ON comprobantes_electronicos FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update comprobantes" ON comprobantes_electronicos FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete comprobantes" ON comprobantes_electronicos FOR DELETE USING (is_org_member(organization_id));

-- CAMPAIGNS
CREATE POLICY "Org members can view campaigns" ON campaigns FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert campaigns" ON campaigns FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update campaigns" ON campaigns FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete campaigns" ON campaigns FOR DELETE USING (is_org_member(organization_id));

-- CAMPAIGN CONTACTS
CREATE POLICY "Org members can view campaign_contacts" ON campaign_contacts FOR SELECT USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND is_org_member(campaigns.organization_id))
);
CREATE POLICY "Org members can insert campaign_contacts" ON campaign_contacts FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND is_org_member(campaigns.organization_id))
);
CREATE POLICY "Org members can update campaign_contacts" ON campaign_contacts FOR UPDATE USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND is_org_member(campaigns.organization_id))
);
CREATE POLICY "Org members can delete campaign_contacts" ON campaign_contacts FOR DELETE USING (
    EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_contacts.campaign_id AND is_org_member(campaigns.organization_id))
);

-- LEAD SOURCES
CREATE POLICY "Org members can view lead_sources" ON lead_sources FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert lead_sources" ON lead_sources FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update lead_sources" ON lead_sources FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete lead_sources" ON lead_sources FOR DELETE USING (is_org_member(organization_id));

-- TEAMS
CREATE POLICY "Org members can view teams" ON teams FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can insert teams" ON teams FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins can update teams" ON teams FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins can delete teams" ON teams FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

-- TEAM MEMBERS
CREATE POLICY "Org members can view team_members" ON team_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND is_org_member(teams.organization_id))
);
CREATE POLICY "Admins can insert team_members" ON team_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND get_org_role(teams.organization_id) IN ('owner', 'admin', 'manager'))
);
CREATE POLICY "Admins can update team_members" ON team_members FOR UPDATE USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND get_org_role(teams.organization_id) IN ('owner', 'admin', 'manager'))
);
CREATE POLICY "Admins can delete team_members" ON team_members FOR DELETE USING (
    EXISTS (SELECT 1 FROM teams WHERE teams.id = team_members.team_id AND get_org_role(teams.organization_id) IN ('owner', 'admin', 'manager'))
);

-- TERRITORIES
CREATE POLICY "Org members can view territories" ON territories FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can insert territories" ON territories FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins can update territories" ON territories FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins can delete territories" ON territories FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

-- DOCUMENTS
CREATE POLICY "Org members can view documents" ON documents FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert documents" ON documents FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update documents" ON documents FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete documents" ON documents FOR DELETE USING (is_org_member(organization_id));

-- NOTIFICATIONS
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);

-- ORGANIZATION SETTINGS
CREATE POLICY "Org members can view org settings" ON organization_settings FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can insert org settings" ON organization_settings FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin'));
CREATE POLICY "Admins can update org settings" ON organization_settings FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin'));
CREATE POLICY "Admins can delete org settings" ON organization_settings FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- ACTIVITIES
CREATE POLICY "Org members can view activities" ON activities FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert activities" ON activities FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update activities" ON activities FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete activities" ON activities FOR DELETE USING (is_org_member(organization_id));

-- SALES GOALS
CREATE POLICY "Org members can view sales_goals" ON sales_goals FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Admins can insert sales_goals" ON sales_goals FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins can update sales_goals" ON sales_goals FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
CREATE POLICY "Admins can delete sales_goals" ON sales_goals FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));
