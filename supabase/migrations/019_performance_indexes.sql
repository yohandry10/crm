-- =====================================================
-- PERFORMANCE INDEXES (MULTI-TENANT)
-- =====================================================

-- Contacts
CREATE INDEX IF NOT EXISTS idx_contacts_lead_status_score ON contacts(organization_id, lead_status, lead_score DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_last_interaction ON contacts(organization_id, last_interaction DESC) WHERE last_interaction IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_tags ON contacts USING gin(tags);

-- Invoices
CREATE INDEX IF NOT EXISTS idx_invoices_status_date ON invoices(organization_id, status, issue_date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_status ON invoices(contact_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_total_date ON invoices(organization_id, total DESC, issue_date DESC);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_gateway_status ON payments(organization_id, gateway, status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(organization_id, paid_at DESC) WHERE paid_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_transaction ON payments(transaction_id) WHERE transaction_id IS NOT NULL;

-- Workflow executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_date ON workflow_executions(workflow_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(organization_id, status, executed_at DESC);

-- Analytics cache
CREATE INDEX IF NOT EXISTS idx_analytics_cache_lookup ON analytics_cache(organization_id, metric_name, period, date DESC);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_auditoria_tabla_registro ON auditoria(tabla, registro_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_org_fecha ON auditoria(organization_id, timestamp DESC);

-- Webhook events
CREATE INDEX IF NOT EXISTS idx_webhook_events_not_processed ON webhook_events(organization_id, created_at) WHERE NOT processed;

-- Chat messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_org_date ON chat_messages(organization_id, created_at DESC);

-- Interactions
CREATE INDEX IF NOT EXISTS idx_interactions_contact_date ON interactions(contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_type_date ON interactions(organization_id, type, created_at DESC);
