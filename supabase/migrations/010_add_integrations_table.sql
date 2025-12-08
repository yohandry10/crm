-- Integrations table (MULTI-TENANT)
CREATE TABLE IF NOT EXISTS integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status TEXT DEFAULT 'disconnected',
    config JSONB,
    last_sync TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_integrations_org ON integrations(organization_id);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view integrations" ON integrations
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can insert integrations" ON integrations
    FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can update integrations" ON integrations
    FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can delete integrations" ON integrations
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));
