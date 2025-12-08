-- =====================================================
-- EVENT TRIGGERS FOR MULTI-TENANT
-- =====================================================

-- Function to emit webhook events (MULTI-TENANT)
CREATE OR REPLACE FUNCTION emit_webhook_event()
RETURNS TRIGGER AS $$
DECLARE
    event_payload JSONB;
    v_org_id UUID;
BEGIN
    IF TG_OP = 'INSERT' THEN
        event_payload = row_to_json(NEW)::JSONB;
        v_org_id = NEW.organization_id;
    ELSIF TG_OP = 'UPDATE' THEN
        event_payload = jsonb_build_object('old', row_to_json(OLD)::JSONB, 'new', row_to_json(NEW)::JSONB);
        v_org_id = NEW.organization_id;
    ELSIF TG_OP = 'DELETE' THEN
        event_payload = row_to_json(OLD)::JSONB;
        v_org_id = OLD.organization_id;
    END IF;

    -- Only insert if we have a valid org_id
    IF v_org_id IS NOT NULL THEN
        INSERT INTO webhook_events (organization_id, event_type, source, payload)
        VALUES (v_org_id, TG_ARGV[0], 'internal', event_payload)
        ON CONFLICT DO NOTHING;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CONTACT EVENTS
-- =====================================================
DROP TRIGGER IF EXISTS trigger_contact_created ON contacts;
CREATE TRIGGER trigger_contact_created
AFTER INSERT ON contacts FOR EACH ROW
EXECUTE FUNCTION emit_webhook_event('contact.created');

DROP TRIGGER IF EXISTS trigger_contact_updated ON contacts;
CREATE TRIGGER trigger_contact_updated
AFTER UPDATE ON contacts FOR EACH ROW
WHEN (OLD.lead_status IS DISTINCT FROM NEW.lead_status OR OLD.lead_score IS DISTINCT FROM NEW.lead_score)
EXECUTE FUNCTION emit_webhook_event('contact.updated');

-- =====================================================
-- INVOICE EVENTS
-- =====================================================
DROP TRIGGER IF EXISTS trigger_invoice_created ON invoices;
CREATE TRIGGER trigger_invoice_created
AFTER INSERT ON invoices FOR EACH ROW
EXECUTE FUNCTION emit_webhook_event('invoice.created');

-- Auto-update invoice totals
CREATE OR REPLACE FUNCTION update_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    invoice_subtotal DECIMAL(10,2);
    invoice_tax DECIMAL(10,2);
    invoice_total DECIMAL(10,2);
    v_invoice_id UUID;
BEGIN
    v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
    
    IF v_invoice_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COALESCE(SUM(total), 0), COALESCE(SUM(total) * 0.18, 0), COALESCE(SUM(total) * 1.18, 0)
    INTO invoice_subtotal, invoice_tax, invoice_total
    FROM invoice_items WHERE invoice_id = v_invoice_id;

    UPDATE invoices SET subtotal = invoice_subtotal, tax = invoice_tax, total = invoice_total, updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_totals ON invoice_items;
CREATE TRIGGER trigger_update_invoice_totals
AFTER INSERT OR UPDATE OR DELETE ON invoice_items FOR EACH ROW
EXECUTE FUNCTION update_invoice_totals();

-- =====================================================
-- PAYMENT EVENTS
-- =====================================================
DROP TRIGGER IF EXISTS trigger_payment_created ON payments;
CREATE TRIGGER trigger_payment_created
AFTER INSERT ON payments FOR EACH ROW
EXECUTE FUNCTION emit_webhook_event('payment.created');

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS NOT NULL AND NEW.status = 'completed' AND NEW.invoice_id IS NOT NULL THEN
        UPDATE invoices SET status = 'paid', updated_at = NOW() WHERE id = NEW.invoice_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_on_payment ON payments;
CREATE TRIGGER trigger_update_invoice_on_payment
AFTER INSERT OR UPDATE ON payments FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_invoice_on_payment();

-- =====================================================
-- CONTACT METRICS
-- =====================================================
CREATE OR REPLACE FUNCTION update_contact_metrics()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS NULL OR NEW.contact_id IS NULL THEN
        RETURN NEW;
    END IF;
    
    IF TG_TABLE_NAME = 'invoices' THEN
        UPDATE contacts SET 
            total_purchases = (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE contact_id = NEW.contact_id AND status = 'paid'),
            updated_at = NOW()
        WHERE id = NEW.contact_id;
    ELSIF TG_TABLE_NAME = 'interactions' THEN
        UPDATE contacts SET 
            interactions_count = interactions_count + 1,
            last_interaction = NEW.created_at,
            updated_at = NOW()
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_contact_on_invoice ON invoices;
CREATE TRIGGER trigger_update_contact_on_invoice
AFTER UPDATE ON invoices FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
EXECUTE FUNCTION update_contact_metrics();

DROP TRIGGER IF EXISTS trigger_update_contact_on_interaction ON interactions;
CREATE TRIGGER trigger_update_contact_on_interaction
AFTER INSERT ON interactions FOR EACH ROW
EXECUTE FUNCTION update_contact_metrics();
