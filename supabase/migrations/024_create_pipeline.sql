-- =====================================================
-- PIPELINE & OPPORTUNITIES (MULTI-TENANT)
-- =====================================================

-- Pipeline stages
CREATE TABLE pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL,
    win_probability FLOAT DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    is_default BOOLEAN DEFAULT FALSE,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pipeline_stages_org ON pipeline_stages(organization_id);

ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view stages" ON pipeline_stages
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can insert stages" ON pipeline_stages
    FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

CREATE POLICY "Admins can update stages" ON pipeline_stages
    FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

CREATE POLICY "Admins can delete stages" ON pipeline_stages
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

-- Opportunities
CREATE TYPE opportunity_status AS ENUM ('open', 'won', 'lost');

CREATE TABLE opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    
    name TEXT NOT NULL,
    description TEXT,
    stage_id UUID REFERENCES pipeline_stages(id) NOT NULL,
    status opportunity_status DEFAULT 'open' NOT NULL,
    expected_revenue DECIMAL(10,2) NOT NULL,
    probability FLOAT,
    expected_close_date DATE,
    actual_close_date DATE,
    lost_reason TEXT,
    next_step TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_org ON opportunities(organization_id);
CREATE INDEX idx_opportunities_org_status ON opportunities(organization_id, status);
CREATE INDEX idx_opportunities_contact ON opportunities(contact_id);
CREATE INDEX idx_opportunities_stage ON opportunities(stage_id);
CREATE INDEX idx_opportunities_assigned ON opportunities(assigned_to);

ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view opportunities" ON opportunities
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert opportunities" ON opportunities
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update opportunities" ON opportunities
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete opportunities" ON opportunities
    FOR DELETE USING (is_org_member(organization_id));

-- Opportunity products
CREATE TABLE opportunity_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL
);

ALTER TABLE opportunity_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view products via opportunities" ON opportunity_products
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM opportunities 
            WHERE opportunities.id = opportunity_products.opportunity_id 
            AND is_org_member(opportunities.organization_id)
        )
    );

CREATE POLICY "Users can insert products via opportunities" ON opportunity_products
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM opportunities 
            WHERE opportunities.id = opportunity_products.opportunity_id 
            AND is_org_member(opportunities.organization_id)
        )
    );

CREATE POLICY "Users can update products via opportunities" ON opportunity_products
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM opportunities 
            WHERE opportunities.id = opportunity_products.opportunity_id 
            AND is_org_member(opportunities.organization_id)
        )
    );

CREATE POLICY "Users can delete products via opportunities" ON opportunity_products
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM opportunities 
            WHERE opportunities.id = opportunity_products.opportunity_id 
            AND is_org_member(opportunities.organization_id)
        )
    );
