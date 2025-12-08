-- =====================================================
-- PAYMENT RECONCILIATION (MULTI-TENANT)
-- =====================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'pending'
    CHECK (reconciliation_status IN ('pending', 'matched', 'partial', 'unmatched'));
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciliation_notes TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reconciled_by UUID REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Auto-reconcile payment (MULTI-TENANT)
CREATE OR REPLACE FUNCTION auto_reconcile_payment(p_payment_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
BEGIN
    IF p_payment_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Payment ID is required');
    END IF;

    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Payment not found'); END IF;
    
    IF v_payment.invoice_id IS NOT NULL THEN
        SELECT * INTO v_invoice FROM invoices WHERE id = v_payment.invoice_id;
        IF FOUND AND v_invoice.total = v_payment.amount THEN
            UPDATE payments SET reconciliation_status = 'matched', reconciled_at = NOW() WHERE id = p_payment_id;
            RETURN jsonb_build_object('matched', true, 'invoice_id', v_invoice.id, 'method', 'manual');
        END IF;
    END IF;
    
    SELECT * INTO v_invoice FROM invoices 
    WHERE organization_id = v_payment.organization_id AND total = v_payment.amount AND status IN ('sent', 'overdue')
    AND id NOT IN (SELECT invoice_id FROM payments WHERE invoice_id IS NOT NULL AND reconciliation_status = 'matched')
    ORDER BY issue_date DESC LIMIT 1;
    
    IF FOUND THEN
        UPDATE payments SET invoice_id = v_invoice.id, reconciliation_status = 'matched', reconciled_at = NOW() WHERE id = p_payment_id;
        UPDATE invoices SET status = 'paid', paid_at = v_payment.payment_date WHERE id = v_invoice.id;
        RETURN jsonb_build_object('matched', true, 'invoice_id', v_invoice.id, 'method', 'auto_exact');
    END IF;
    
    UPDATE payments SET reconciliation_status = 'unmatched', reconciled_at = NOW() WHERE id = p_payment_id;
    RETURN jsonb_build_object('matched', false, 'message', 'No matching invoice found');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Manual reconciliation (MULTI-TENANT)
CREATE OR REPLACE FUNCTION manual_reconcile_payment(
    p_payment_id UUID,
    p_invoice_id UUID,
    p_user_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
BEGIN
    IF p_payment_id IS NULL OR p_invoice_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment ID and Invoice ID are required');
    END IF;

    SELECT * INTO v_payment FROM payments WHERE id = p_payment_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Payment not found'); END IF;
    
    SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id AND organization_id = v_payment.organization_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invoice not found'); END IF;
    
    UPDATE payments SET invoice_id = p_invoice_id,
        reconciliation_status = CASE WHEN amount = v_invoice.total THEN 'matched' ELSE 'partial' END,
        reconciliation_notes = p_notes, reconciled_at = NOW(), reconciled_by = p_user_id
    WHERE id = p_payment_id;
    
    IF v_payment.amount >= v_invoice.total THEN
        UPDATE invoices SET status = 'paid', paid_at = v_payment.payment_date WHERE id = p_invoice_id;
    END IF;
    
    RETURN jsonb_build_object('success', true, 'payment_id', p_payment_id, 'invoice_id', p_invoice_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_payments_reconciliation ON payments(organization_id, reconciliation_status, payment_date DESC) WHERE reconciliation_status IN ('pending', 'unmatched');
CREATE INDEX IF NOT EXISTS idx_invoices_unpaid ON invoices(organization_id, status, total) WHERE status IN ('sent', 'overdue');
