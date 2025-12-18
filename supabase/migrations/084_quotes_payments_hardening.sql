-- Quotes + Payments hardening
-- - Link quote_items to products for stock checks/deduction
-- - Add payment proof fields used by UI verification panel
-- - Add atomic Stripe/webhook payment processing
-- - Add helper RPC for unreconciled payments list

-- 1) quote_items: optional product_id
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_items_product_id ON quote_items(product_id);

-- 2) payments: proof + notes + verification timestamp
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS proof_url TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 3) Atomic payment processing for gateways (Stripe webhook)
-- Idempotent by (gateway, transaction_id, organization_id).
CREATE OR REPLACE FUNCTION process_payment_atomic(
  p_user_id UUID,
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_gateway TEXT,
  p_transaction_id TEXT,
  p_organization_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_invoice RECORD;
  v_payment RECORD;
  v_total_paid NUMERIC;
BEGIN
  IF p_invoice_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invoice_id or amount');
  END IF;

  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF p_transaction_id IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM payments
    WHERE organization_id = v_invoice.organization_id
      AND gateway = p_gateway
      AND transaction_id = p_transaction_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'payment_id', v_payment.id, 'cached', true);
    END IF;
  END IF;

  INSERT INTO payments (
    organization_id,
    created_by,
    contact_id,
    invoice_id,
    amount,
    currency,
    status,
    payment_method,
    transaction_id,
    gateway,
    paid_at,
    metadata
  )
  VALUES (
    v_invoice.organization_id,
    p_user_id,
    v_invoice.contact_id,
    v_invoice.id,
    p_amount,
    v_invoice.currency,
    'completed',
    p_payment_method,
    p_transaction_id,
    p_gateway,
    NOW(),
    jsonb_build_object('source', 'process_payment_atomic')
  )
  RETURNING * INTO v_payment;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE invoice_id = v_invoice.id
    AND organization_id = v_invoice.organization_id
    AND status = 'completed';

  IF v_total_paid >= v_invoice.total THEN
    UPDATE invoices
    SET status = 'paid',
        paid_at = NOW(),
        updated_at = NOW()
    WHERE id = v_invoice.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', v_payment.id,
    'invoice_id', v_invoice.id,
    'invoice_paid', (v_total_paid >= v_invoice.total),
    'total_paid', v_total_paid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION process_payment_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) TO service_role;

-- 4) Unreconciled payments list (used by /api/payments/reconcile)
CREATE OR REPLACE FUNCTION get_unreconciled_payments(p_organization_id UUID)
RETURNS TABLE (
  payment_id UUID,
  amount NUMERIC,
  created_at TIMESTAMPTZ,
  status TEXT,
  invoice_id UUID,
  invoice_number TEXT,
  invoice_total NUMERIC,
  contact_name TEXT,
  contact_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.amount,
    p.created_at,
    p.status::TEXT,
    p.invoice_id,
    i.invoice_number,
    i.total,
    c.name,
    c.email
  FROM payments p
  LEFT JOIN invoices i ON i.id = p.invoice_id
  LEFT JOIN contacts c ON c.id = p.contact_id
  WHERE p.organization_id = p_organization_id
    AND (p.reconciliation_status IN ('pending', 'unmatched') OR p.invoice_id IS NULL)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_unreconciled_payments(UUID) TO authenticated;
