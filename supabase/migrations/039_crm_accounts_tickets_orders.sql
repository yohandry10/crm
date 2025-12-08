-- =====================================================
-- ACCOUNTS, TICKETS, SALES ORDERS (MULTI-TENANT)
-- =====================================================

-- 1) Accounts (Empresas)
CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    ruc VARCHAR(20),
    industry TEXT,
    website TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    country TEXT,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_accounts_org ON accounts(organization_id);
CREATE INDEX idx_accounts_name_trgm ON accounts USING gin (upper(name) gin_trgm_ops);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view accounts" ON accounts FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert accounts" ON accounts FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update accounts" ON accounts FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete accounts" ON accounts FOR DELETE USING (is_org_member(organization_id));

-- Vincular contactos con cuentas
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_account ON contacts(account_id);

-- 2) Tickets (Soporte)
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    status ticket_status DEFAULT 'open',
    priority ticket_priority DEFAULT 'medium',
    sla_due_at TIMESTAMPTZ,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_org ON tickets(organization_id);
CREATE INDEX idx_tickets_org_status ON tickets(organization_id, status);
CREATE INDEX idx_tickets_assigned ON tickets(assigned_to);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view tickets" ON tickets FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert tickets" ON tickets FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update tickets" ON tickets FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete tickets" ON tickets FOR DELETE USING (is_org_member(organization_id));

-- 3) Sales Orders
CREATE TYPE sales_order_status AS ENUM ('draft', 'confirmed', 'fulfilled', 'cancelled');

CREATE TABLE IF NOT EXISTS sales_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    status sales_order_status DEFAULT 'draft',
    currency TEXT DEFAULT 'PEN',
    subtotal NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) DEFAULT 0,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_orders_org ON sales_orders(organization_id);
CREATE INDEX idx_sales_orders_org_status ON sales_orders(organization_id, status);

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view sales_orders" ON sales_orders FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert sales_orders" ON sales_orders FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update sales_orders" ON sales_orders FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete sales_orders" ON sales_orders FOR DELETE USING (is_org_member(organization_id));
