-- =====================================================
-- PERFORMANCE INDEXES FOR MULTI-TENANT
-- =====================================================

-- Contacts indexes (organization_id first for partition pruning)
CREATE INDEX IF NOT EXISTS idx_contacts_org_status ON contacts(organization_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_contacts_org_score ON contacts(organization_id, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_org_created ON contacts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_date ON invoices(organization_id, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_contact ON invoices(contact_id);

-- Interactions indexes
CREATE INDEX IF NOT EXISTS idx_interactions_org_created ON interactions(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_contact ON interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_interactions_type ON interactions(type);

-- Workflows indexes
CREATE INDEX IF NOT EXISTS idx_workflows_org_active ON workflows(organization_id, is_active);
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type);

-- Workflow executions indexes
CREATE INDEX IF NOT EXISTS idx_workflow_exec_org ON workflow_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_exec_status ON workflow_executions(status);

-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_org_created ON chat_messages(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_contact ON chat_messages(contact_id);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_org_status ON payments(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_contact ON payments(contact_id);

-- Analytics cache indexes
CREATE INDEX IF NOT EXISTS idx_analytics_org_metric ON analytics_cache(organization_id, metric_name, period);

-- Auditoria indexes
CREATE INDEX IF NOT EXISTS idx_auditoria_org_time ON auditoria(organization_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla ON auditoria(tabla);
