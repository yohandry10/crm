-- Inventory table (MULTI-TENANT)
CREATE TABLE IF NOT EXISTS inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_inventory_org ON inventory(organization_id);

ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view inventory" ON inventory
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert inventory" ON inventory
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update inventory" ON inventory
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete inventory" ON inventory
    FOR DELETE USING (is_org_member(organization_id));

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON inventory FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
