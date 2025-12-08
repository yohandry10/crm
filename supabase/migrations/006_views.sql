-- =====================================================
-- MULTI-TENANT VIEWS
-- =====================================================

-- View for contact analytics (MULTI-TENANT)
CREATE VIEW contact_analytics AS
SELECT 
    c.organization_id,
    COUNT(*) as total_contacts,
    COUNT(*) FILTER (WHERE lead_status = 'hot') as hot_leads,
    COUNT(*) FILTER (WHERE lead_status = 'warm') as warm_leads,
    COUNT(*) FILTER (WHERE lead_status = 'cold') as cold_leads,
    COUNT(*) FILTER (WHERE lead_status = 'converted') as converted_leads,
    AVG(lead_score) as avg_lead_score,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_contacts_30d,
    COUNT(*) FILTER (WHERE last_interaction > NOW() - INTERVAL '7 days') as active_contacts_7d
FROM contacts c
GROUP BY c.organization_id;

-- View for sales analytics (MULTI-TENANT)
CREATE VIEW sales_analytics AS
SELECT 
    i.organization_id,
    DATE_TRUNC('month', i.created_at) as month,
    COUNT(*) as total_invoices,
    COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
    COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices,
    SUM(total) as total_amount,
    SUM(total) FILTER (WHERE status = 'paid') as paid_amount,
    AVG(total) as avg_invoice_amount
FROM invoices i
GROUP BY i.organization_id, DATE_TRUNC('month', i.created_at);

-- View for interaction analytics (MULTI-TENANT)
CREATE VIEW interaction_analytics AS
SELECT 
    i.organization_id,
    DATE_TRUNC('day', i.created_at) as day,
    COUNT(*) as total_interactions,
    COUNT(*) FILTER (WHERE type = 'call') as calls,
    COUNT(*) FILTER (WHERE type = 'email') as emails,
    COUNT(*) FILTER (WHERE type = 'whatsapp') as whatsapp_messages,
    COUNT(*) FILTER (WHERE type = 'meeting') as meetings
FROM interactions i
GROUP BY i.organization_id, DATE_TRUNC('day', i.created_at);

-- View for top performing contacts (MULTI-TENANT)
CREATE VIEW top_contacts AS
SELECT 
    c.*,
    COALESCE(SUM(inv.total) FILTER (WHERE inv.status = 'paid'), 0) as total_revenue,
    COUNT(inv.id) as total_invoices,
    COUNT(int.id) as total_interactions,
    MAX(int.created_at) as last_interaction_date
FROM contacts c
LEFT JOIN invoices inv ON c.id = inv.contact_id
LEFT JOIN interactions int ON c.id = int.contact_id
GROUP BY c.id
ORDER BY total_revenue DESC, lead_score DESC;

-- View for organization dashboard stats
CREATE VIEW organization_stats AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    (SELECT COUNT(*) FROM contacts WHERE organization_id = o.id) as total_contacts,
    (SELECT COUNT(*) FROM invoices WHERE organization_id = o.id) as total_invoices,
    (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE organization_id = o.id AND status = 'paid') as total_revenue,
    (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id AND is_active = TRUE) as total_members
FROM organizations o;
