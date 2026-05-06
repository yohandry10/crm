-- Atomic manual payment registration.
-- Closes the balance-check race by locking the invoice row before inserting a
-- completed payment and computing the paid total inside one database transaction.

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_org_gateway_transaction_unique
ON payments(organization_id, gateway, transaction_id)
WHERE transaction_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_invoice_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_total NUMERIC;
  v_total_paid NUMERIC;
BEGIN
  IF NEW IS NOT NULL AND NEW.status = 'completed' AND NEW.invoice_id IS NOT NULL THEN
    SELECT total INTO v_invoice_total
    FROM invoices
    WHERE id = NEW.invoice_id
      AND organization_id = NEW.organization_id;

    IF FOUND THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
      FROM payments
      WHERE invoice_id = NEW.invoice_id
        AND organization_id = NEW.organization_id
        AND status = 'completed';

      IF v_total_paid >= v_invoice_total THEN
        UPDATE invoices
        SET status = 'paid',
            paid_at = COALESCE(paid_at, NOW()),
            updated_at = NOW()
        WHERE id = NEW.invoice_id
          AND organization_id = NEW.organization_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION record_payment_atomic(
  p_user_id UUID,
  p_organization_id UUID,
  p_invoice_id UUID,
  p_amount NUMERIC,
  p_payment_method TEXT,
  p_gateway TEXT,
  p_transaction_id TEXT DEFAULT NULL,
  p_proof_url TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_payment RECORD;
  v_total_paid NUMERIC := 0;
  v_effective_status payment_status;
  v_is_fully_paid BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_invoice_id IS NULL OR p_amount IS NULL OR p_amount <= 0 OR p_gateway IS NULL OR length(trim(p_gateway)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid payment request');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = p_organization_id
      AND user_id = p_user_id
      AND is_active = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a member of this organization');
  END IF;

  SELECT * INTO v_invoice
  FROM invoices
  WHERE id = p_invoice_id
    AND organization_id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Factura no encontrada');
  END IF;

  v_effective_status := COALESCE(
    p_status,
    CASE WHEN p_proof_url IS NOT NULL THEN 'pending' ELSE 'completed' END
  )::payment_status;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM payments
    WHERE organization_id = p_organization_id
      AND idempotency_key = p_idempotency_key
    LIMIT 1;

    IF FOUND THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
      FROM payments
      WHERE invoice_id = p_invoice_id
        AND organization_id = p_organization_id
        AND status = 'completed';

      RETURN jsonb_build_object(
        'success', true,
        'cached', true,
        'payment_id', v_payment.id,
        'status', v_payment.status,
        'is_fully_paid', v_invoice.status = 'paid',
        'total_paid', v_total_paid
      );
    END IF;
  END IF;

  IF p_transaction_id IS NOT NULL THEN
    SELECT * INTO v_payment
    FROM payments
    WHERE organization_id = p_organization_id
      AND gateway = p_gateway
      AND transaction_id = p_transaction_id
    LIMIT 1;

    IF FOUND THEN
      SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
      FROM payments
      WHERE invoice_id = p_invoice_id
        AND organization_id = p_organization_id
        AND status = 'completed';

      RETURN jsonb_build_object(
        'success', true,
        'cached', true,
        'payment_id', v_payment.id,
        'status', v_payment.status,
        'is_fully_paid', v_invoice.status = 'paid',
        'total_paid', v_total_paid
      );
    END IF;
  END IF;

  IF v_effective_status = 'completed' THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE invoice_id = p_invoice_id
      AND organization_id = p_organization_id
      AND status = 'completed';

    IF p_amount > (v_invoice.total - v_total_paid) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'El monto del pago excede el saldo pendiente de la factura',
        'invoice_total', v_invoice.total,
        'total_paid', v_total_paid,
        'remaining_balance', v_invoice.total - v_total_paid,
        'payment_amount', p_amount
      );
    END IF;
  END IF;

  BEGIN
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
      proof_url,
      notes,
      idempotency_key,
      metadata
    )
    VALUES (
      p_organization_id,
      p_user_id,
      v_invoice.contact_id,
      v_invoice.id,
      p_amount,
      v_invoice.currency,
      v_effective_status,
      p_payment_method,
      p_transaction_id,
      p_gateway,
      CASE WHEN v_effective_status = 'completed' THEN NOW() ELSE NULL END,
      p_proof_url,
      p_notes,
      p_idempotency_key,
      jsonb_build_object('source', 'record_payment_atomic')
    )
    RETURNING * INTO v_payment;
  EXCEPTION WHEN unique_violation THEN
    SELECT * INTO v_payment
    FROM payments
    WHERE organization_id = p_organization_id
      AND (
        (p_idempotency_key IS NOT NULL AND idempotency_key = p_idempotency_key)
        OR
        (p_transaction_id IS NOT NULL AND gateway = p_gateway AND transaction_id = p_transaction_id)
      )
    LIMIT 1;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM payments
    WHERE invoice_id = p_invoice_id
      AND organization_id = p_organization_id
      AND status = 'completed';

    RETURN jsonb_build_object(
      'success', true,
      'cached', true,
      'payment_id', v_payment.id,
      'status', v_payment.status,
      'is_fully_paid', v_invoice.status = 'paid',
      'total_paid', v_total_paid
    );
  END;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE invoice_id = v_invoice.id
    AND organization_id = p_organization_id
    AND status = 'completed';

  v_is_fully_paid := v_total_paid >= v_invoice.total;

  IF v_effective_status = 'completed' AND v_is_fully_paid THEN
    UPDATE invoices
    SET status = 'paid',
        paid_at = COALESCE(paid_at, NOW()),
        updated_at = NOW()
    WHERE id = v_invoice.id
      AND organization_id = p_organization_id;

    UPDATE quotes
    SET status = 'paid',
        updated_at = NOW()
    WHERE invoice_id = v_invoice.id
      AND organization_id = p_organization_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'cached', false,
    'payment_id', v_payment.id,
    'status', v_payment.status,
    'is_fully_paid', v_is_fully_paid,
    'total_paid', v_total_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION record_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION record_payment_atomic(UUID, UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
