-- =====================================================
-- MULTI-TENANT RLS POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ORGANIZATIONS POLICIES
-- =====================================================
CREATE POLICY "Users can view their organizations" ON organizations
    FOR SELECT USING (is_org_member(id));

CREATE POLICY "Admins can update organization" ON organizations
    FOR UPDATE USING (get_org_role(id) IN ('owner', 'admin'));

CREATE POLICY "Authenticated users can create organizations" ON organizations
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can delete organization" ON organizations
    FOR DELETE USING (get_org_role(id) = 'owner');

-- =====================================================
-- ORGANIZATION MEMBERS POLICIES
-- =====================================================
CREATE POLICY "Members can view org members" ON organization_members
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can insert members" ON organization_members
    FOR INSERT WITH CHECK (
        get_org_role(organization_id) IN ('owner', 'admin')
        OR (auth.uid() = user_id AND NOT EXISTS (
            SELECT 1 FROM organization_members om WHERE om.organization_id = organization_members.organization_id
        ))
    );

CREATE POLICY "Admins can update members" ON organization_members
    FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Owners can delete members or self-remove" ON organization_members
    FOR DELETE USING (get_org_role(organization_id) = 'owner' OR user_id = auth.uid());

-- =====================================================
-- ORGANIZATION INVITATIONS POLICIES
-- =====================================================
CREATE POLICY "Admins can view invitations" ON organization_invitations
    FOR SELECT USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can insert invitations" ON organization_invitations
    FOR INSERT WITH CHECK (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can update invitations" ON organization_invitations
    FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can delete invitations" ON organization_invitations
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Users can view their invitations" ON organization_invitations
    FOR SELECT USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- =====================================================
-- PROFILES POLICIES
-- =====================================================
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Org members can view other members profiles" ON profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om1
            JOIN organization_members om2 ON om1.organization_id = om2.organization_id
            WHERE om1.user_id = auth.uid() AND om2.user_id = profiles.id
            AND om1.is_active = TRUE AND om2.is_active = TRUE
        )
    );

-- =====================================================
-- CONTACTS POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view contacts" ON contacts
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert contacts" ON contacts
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update contacts" ON contacts
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Admins can delete contacts" ON contacts
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

-- =====================================================
-- INTERACTIONS POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view interactions" ON interactions
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert interactions" ON interactions
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update interactions" ON interactions
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete interactions" ON interactions
    FOR DELETE USING (is_org_member(organization_id));

-- =====================================================
-- INVOICES POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view invoices" ON invoices
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert invoices" ON invoices
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update invoices" ON invoices
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Admins can delete invoices" ON invoices
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- =====================================================
-- INVOICE ITEMS POLICIES
-- =====================================================
CREATE POLICY "Users can view invoice items" ON invoice_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND is_org_member(invoices.organization_id))
    );

CREATE POLICY "Users can insert invoice items" ON invoice_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND is_org_member(invoices.organization_id))
    );

CREATE POLICY "Users can update invoice items" ON invoice_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND is_org_member(invoices.organization_id))
    );

CREATE POLICY "Users can delete invoice items" ON invoice_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM invoices WHERE invoices.id = invoice_items.invoice_id AND is_org_member(invoices.organization_id))
    );

-- =====================================================
-- PAYMENTS POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view payments" ON payments
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert payments" ON payments
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update payments" ON payments
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Admins can delete payments" ON payments
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- =====================================================
-- ANALYTICS CACHE POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view analytics" ON analytics_cache
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert analytics" ON analytics_cache
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update analytics" ON analytics_cache
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete analytics" ON analytics_cache
    FOR DELETE USING (is_org_member(organization_id));

-- =====================================================
-- WORKFLOWS POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view workflows" ON workflows
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can insert workflows" ON workflows
    FOR INSERT WITH CHECK (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

CREATE POLICY "Admins can update workflows" ON workflows
    FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin', 'manager'));

CREATE POLICY "Admins can delete workflows" ON workflows
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- =====================================================
-- WORKFLOW EXECUTIONS POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view workflow executions" ON workflow_executions
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "System can insert workflow executions" ON workflow_executions
    FOR INSERT WITH CHECK (is_org_member(organization_id));

-- =====================================================
-- CHAT MESSAGES POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view chat messages" ON chat_messages
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert chat messages" ON chat_messages
    FOR INSERT WITH CHECK (is_org_member(organization_id));

-- =====================================================
-- WEBHOOK EVENTS POLICIES
-- =====================================================
CREATE POLICY "Admins can view webhook events" ON webhook_events
    FOR SELECT USING (
        organization_id IS NULL OR get_org_role(organization_id) IN ('owner', 'admin')
    );

CREATE POLICY "Service can insert webhook events" ON webhook_events
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- AUDITORIA POLICIES (MULTI-TENANT)
-- =====================================================
CREATE POLICY "Org members can view audit logs" ON auditoria
    FOR SELECT USING (
        organization_id IS NULL AND auth.uid() = usuario_id
        OR is_org_member(organization_id)
    );

CREATE POLICY "Service can insert audit logs" ON auditoria
    FOR INSERT WITH CHECK (true);
