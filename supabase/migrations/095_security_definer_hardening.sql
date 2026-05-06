-- Security definer hardening
-- - Locks search_path for sensitive functions
-- - Removes PUBLIC execution from SECURITY DEFINER helpers
-- - Adds internal tenant/role checks to RPCs exposed to authenticated users
-- - Removes broad access to decrypted organization credentials

-- =====================================================
-- Stock helpers
-- =====================================================

CREATE OR REPLACE FUNCTION check_quote_stock_availability(p_quote_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    required_quantity NUMERIC,
    available_quantity NUMERIC,
    has_stock BOOLEAN
) AS $$
DECLARE
    v_organization_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT organization_id
    INTO v_organization_id
    FROM quotes
    WHERE id = p_quote_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Quote not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = v_organization_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Not authorized for organization %', v_organization_id USING ERRCODE = '42501';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM quote_items qi
        LEFT JOIN products p
          ON p.id = qi.product_id
         AND p.organization_id = v_organization_id
        WHERE qi.quote_id = p_quote_id
          AND qi.product_id IS NOT NULL
          AND p.id IS NULL
    ) THEN
        RAISE EXCEPTION 'Quote contains products outside the organization' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        p.id AS product_id,
        p.name AS product_name,
        qi.quantity AS required_quantity,
        COALESCE(p.stock_quantity, 0)::NUMERIC AS available_quantity,
        COALESCE(p.stock_quantity, 0)::NUMERIC >= qi.quantity AS has_stock
    FROM quote_items qi
    JOIN products p
      ON p.id = qi.product_id
     AND p.organization_id = v_organization_id
    WHERE qi.quote_id = p_quote_id
      AND qi.product_id IS NOT NULL
      AND COALESCE(p.is_service, FALSE) = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION check_quote_stock_availability(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_quote_stock_availability(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
DECLARE
    v_product RECORD;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_product_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Invalid product or quantity';
    END IF;

    SELECT id, organization_id, name, stock_quantity, is_service
    INTO v_product
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = v_product.organization_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Not authorized for organization %', v_product.organization_id USING ERRCODE = '42501';
    END IF;

    IF COALESCE(v_product.is_service, FALSE) THEN
        RETURN;
    END IF;

    IF COALESCE(v_product.stock_quantity, 0) < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product %', v_product.name;
    END IF;

    UPDATE products
    SET stock_quantity = stock_quantity - p_quantity,
        updated_at = NOW()
    WHERE id = v_product.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION decrement_stock(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION decrement_stock(UUID, INTEGER) TO authenticated;

-- =====================================================
-- Public payment token helper
-- =====================================================

CREATE OR REPLACE FUNCTION generate_payment_token(
    p_organization_id UUID,
    p_quote_id UUID DEFAULT NULL,
    p_invoice_id UUID DEFAULT NULL,
    p_expires_days INTEGER DEFAULT 30
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
    v_resource_org_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF (p_quote_id IS NULL AND p_invoice_id IS NULL)
       OR (p_quote_id IS NOT NULL AND p_invoice_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Exactly one of quote_id or invoice_id is required';
    END IF;

    IF p_expires_days IS NULL OR p_expires_days < 1 OR p_expires_days > 365 THEN
        RAISE EXCEPTION 'expires_days must be between 1 and 365';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = p_organization_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Not authorized for organization %', p_organization_id USING ERRCODE = '42501';
    END IF;

    IF p_quote_id IS NOT NULL THEN
        SELECT organization_id INTO v_resource_org_id
        FROM quotes
        WHERE id = p_quote_id;
    ELSE
        SELECT organization_id INTO v_resource_org_id
        FROM invoices
        WHERE id = p_invoice_id;
    END IF;

    IF v_resource_org_id IS NULL OR v_resource_org_id <> p_organization_id THEN
        RAISE EXCEPTION 'Payment resource not found for organization' USING ERRCODE = '42501';
    END IF;

    INSERT INTO public_payment_tokens (organization_id, quote_id, invoice_id, expires_at)
    VALUES (
        p_organization_id,
        p_quote_id,
        p_invoice_id,
        NOW() + (p_expires_days || ' days')::INTERVAL
    )
    RETURNING token INTO v_token;

    RETURN v_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION generate_payment_token(UUID, UUID, UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION generate_payment_token(UUID, UUID, UUID, INTEGER) TO authenticated;

-- =====================================================
-- Payment reconciliation helpers
-- =====================================================

ALTER FUNCTION process_payment_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID)
    SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION process_payment_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION process_payment_atomic(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) TO service_role;

ALTER FUNCTION auto_reconcile_payment(UUID)
    SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION auto_reconcile_payment(UUID) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION auto_reconcile_payment(UUID) TO service_role;

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
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM organization_members om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = v_user_id
      AND om.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Not authorized for organization %', p_organization_id USING ERRCODE = '42501';
  END IF;

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
  LEFT JOIN invoices i ON i.id = p.invoice_id AND i.organization_id = p_organization_id
  LEFT JOIN contacts c ON c.id = p.contact_id AND c.organization_id = p_organization_id
  WHERE p.organization_id = p_organization_id
    AND (p.reconciliation_status IN ('pending', 'unmatched') OR p.invoice_id IS NULL)
  ORDER BY p.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION get_unreconciled_payments(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_unreconciled_payments(UUID) TO authenticated;

DROP FUNCTION IF EXISTS manual_reconcile_payment(UUID, UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION manual_reconcile_payment(
    p_payment_id UUID,
    p_invoice_id UUID,
    p_organization_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_payment RECORD;
    v_invoice RECORD;
    v_total_paid NUMERIC;
    v_status TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;

    IF p_payment_id IS NULL OR p_invoice_id IS NULL OR p_organization_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment, invoice and organization are required');
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = p_organization_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
    ) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
    END IF;

    SELECT *
    INTO v_payment
    FROM payments
    WHERE id = p_payment_id
      AND organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Payment not found');
    END IF;

    SELECT *
    INTO v_invoice
    FROM invoices
    WHERE id = p_invoice_id
      AND organization_id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
    END IF;

    v_status := CASE
        WHEN v_payment.amount >= v_invoice.total THEN 'matched'
        ELSE 'partial'
    END;

    UPDATE payments
    SET invoice_id = p_invoice_id,
        reconciliation_status = v_status,
        reconciliation_notes = p_notes,
        reconciled_at = NOW(),
        reconciled_by = v_user_id,
        updated_at = NOW()
    WHERE id = p_payment_id
      AND organization_id = p_organization_id;

    SELECT COALESCE(SUM(amount), 0)
    INTO v_total_paid
    FROM payments
    WHERE invoice_id = p_invoice_id
      AND organization_id = p_organization_id
      AND status = 'completed';

    IF v_total_paid >= v_invoice.total THEN
        UPDATE invoices
        SET status = 'paid',
            paid_at = COALESCE(v_payment.payment_date, v_payment.paid_at, NOW()),
            updated_at = NOW()
        WHERE id = p_invoice_id
          AND organization_id = p_organization_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'payment_id', p_payment_id,
        'invoice_id', p_invoice_id,
        'status', v_status,
        'total_paid', v_total_paid,
        'invoice_paid', (v_total_paid >= v_invoice.total)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION manual_reconcile_payment(UUID, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION manual_reconcile_payment(UUID, UUID, UUID, TEXT) TO authenticated;

-- =====================================================
-- Credential encryption helpers
-- =====================================================

CREATE OR REPLACE FUNCTION encrypt_secret(secret TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    encryption_key := current_setting('app.encryption_key', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
        RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key';
    END IF;

    IF secret IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN encode(
        pgp_sym_encrypt(
            secret,
            encryption_key,
            'cipher-algo=aes256'
        ),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION decrypt_secret(encrypted_secret TEXT)
RETURNS TEXT AS $$
DECLARE
    encryption_key TEXT;
BEGIN
    IF encrypted_secret IS NULL THEN
        RETURN NULL;
    END IF;

    encryption_key := current_setting('app.encryption_key', true);

    IF encryption_key IS NULL OR encryption_key = '' THEN
        RAISE EXCEPTION 'Encryption key not configured. Set app.encryption_key';
    END IF;

    RETURN pgp_sym_decrypt(
        decode(encrypted_secret, 'base64'),
        encryption_key
    );
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Failed to decrypt secret: %', SQLERRM;
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION encrypt_secret(TEXT) FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION decrypt_secret(TEXT) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION encrypt_secret(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrypt_secret(TEXT) TO service_role;

REVOKE SELECT ON organizations_decrypted FROM PUBLIC, authenticated;
GRANT SELECT ON organizations_decrypted TO service_role;
COMMENT ON VIEW organizations_decrypted IS 'Service-role only compatibility view. Do not grant to authenticated because it decrypts organization secrets.';

CREATE OR REPLACE FUNCTION upsert_organization_credentials(
    org_id UUID,
    sunat_user TEXT DEFAULT NULL,
    sunat_pass TEXT DEFAULT NULL,
    ose_key TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = org_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
          AND om.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Not authorized to update organization credentials' USING ERRCODE = '42501';
    END IF;

    UPDATE organizations
    SET
        sunat_usuario_sol_encrypted = CASE
            WHEN sunat_user IS NOT NULL THEN encrypt_secret(sunat_user)
            ELSE sunat_usuario_sol_encrypted
        END,
        sunat_clave_sol_encrypted = CASE
            WHEN sunat_pass IS NOT NULL THEN encrypt_secret(sunat_pass)
            ELSE sunat_clave_sol_encrypted
        END,
        ose_api_key_encrypted = CASE
            WHEN ose_key IS NOT NULL THEN encrypt_secret(ose_key)
            ELSE ose_api_key_encrypted
        END,
        updated_at = NOW()
    WHERE id = org_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0002';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION upsert_email_account_tokens(
    account_id UUID,
    access_tok TEXT DEFAULT NULL,
    refresh_tok TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_account_user_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT user_id
    INTO v_account_user_id
    FROM email_accounts
    WHERE id = account_id;

    IF v_account_user_id IS NULL THEN
        RAISE EXCEPTION 'Email account not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_account_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Not authorized to update email tokens' USING ERRCODE = '42501';
    END IF;

    UPDATE email_accounts
    SET
        access_token_encrypted = CASE
            WHEN access_tok IS NOT NULL THEN encrypt_secret(access_tok)
            ELSE access_token_encrypted
        END,
        refresh_token_encrypted = CASE
            WHEN refresh_tok IS NOT NULL THEN encrypt_secret(refresh_tok)
            ELSE refresh_token_encrypted
        END,
        updated_at = NOW()
    WHERE id = account_id
      AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION upsert_integration_config(
    integration_id UUID,
    new_config JSONB
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_organization_id UUID;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT organization_id
    INTO v_organization_id
    FROM integrations
    WHERE id = integration_id;

    IF v_organization_id IS NULL THEN
        RAISE EXCEPTION 'Integration not found' USING ERRCODE = 'P0002';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = v_organization_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
          AND om.role IN ('owner', 'admin')
    ) THEN
        RAISE EXCEPTION 'Not authorized to update integration config' USING ERRCODE = '42501';
    END IF;

    UPDATE integrations
    SET
        config = NULL,
        config_encrypted = encrypt_secret(new_config::text),
        updated_at = NOW()
    WHERE id = integration_id
      AND organization_id = v_organization_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION upsert_organization_credentials(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_email_account_tokens(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION upsert_integration_config(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION upsert_organization_credentials(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_email_account_tokens(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_integration_config(UUID, JSONB) TO authenticated;

-- Trigger functions can run as definer because direct EXECUTE on encrypt_secret is no longer
-- available to authenticated users.
CREATE OR REPLACE FUNCTION auto_encrypt_organization_credentials()
RETURNS TRIGGER AS $$
DECLARE
    v_should_encrypt BOOLEAN;
BEGIN
    IF NEW.sunat_usuario_sol IS NOT NULL AND NEW.sunat_usuario_sol != '' THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.sunat_usuario_sol_encrypted IS NULL
                OR OLD.sunat_usuario_sol IS DISTINCT FROM NEW.sunat_usuario_sol;
        END IF;

        IF v_should_encrypt THEN
            NEW.sunat_usuario_sol_encrypted := encrypt_secret(NEW.sunat_usuario_sol);
            NEW.sunat_usuario_sol := NULL;
        END IF;
    END IF;

    IF NEW.sunat_clave_sol IS NOT NULL AND NEW.sunat_clave_sol != '' THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.sunat_clave_sol_encrypted IS NULL
                OR OLD.sunat_clave_sol IS DISTINCT FROM NEW.sunat_clave_sol;
        END IF;

        IF v_should_encrypt THEN
            NEW.sunat_clave_sol_encrypted := encrypt_secret(NEW.sunat_clave_sol);
            NEW.sunat_clave_sol := NULL;
        END IF;
    END IF;

    IF NEW.ose_api_key IS NOT NULL AND NEW.ose_api_key != '' THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.ose_api_key_encrypted IS NULL
                OR OLD.ose_api_key IS DISTINCT FROM NEW.ose_api_key;
        END IF;

        IF v_should_encrypt THEN
            NEW.ose_api_key_encrypted := encrypt_secret(NEW.ose_api_key);
            NEW.ose_api_key := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION auto_encrypt_email_tokens()
RETURNS TRIGGER AS $$
DECLARE
    v_should_encrypt BOOLEAN;
BEGIN
    IF NEW.access_token IS NOT NULL AND NEW.access_token != '' THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.access_token_encrypted IS NULL
                OR OLD.access_token IS DISTINCT FROM NEW.access_token;
        END IF;

        IF v_should_encrypt THEN
            NEW.access_token_encrypted := encrypt_secret(NEW.access_token);
            NEW.access_token := NULL;
        END IF;
    END IF;

    IF NEW.refresh_token IS NOT NULL AND NEW.refresh_token != '' THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.refresh_token_encrypted IS NULL
                OR OLD.refresh_token IS DISTINCT FROM NEW.refresh_token;
        END IF;

        IF v_should_encrypt THEN
            NEW.refresh_token_encrypted := encrypt_secret(NEW.refresh_token);
            NEW.refresh_token := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION auto_encrypt_integration_config()
RETURNS TRIGGER AS $$
DECLARE
    v_should_encrypt BOOLEAN;
BEGIN
    IF NEW.config IS NOT NULL THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.config_encrypted IS NULL
                OR OLD.config IS DISTINCT FROM NEW.config;
        END IF;

        IF v_should_encrypt THEN
            NEW.config_encrypted := encrypt_secret(NEW.config::text);
            NEW.config := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION auto_encrypt_webhook_secret()
RETURNS TRIGGER AS $$
DECLARE
    v_should_encrypt BOOLEAN;
BEGIN
    IF NEW.secret IS NOT NULL AND NEW.secret != '' THEN
        IF TG_OP = 'INSERT' THEN
            v_should_encrypt := TRUE;
        ELSE
            v_should_encrypt := NEW.secret_encrypted IS NULL
                OR OLD.secret IS DISTINCT FROM NEW.secret;
        END IF;

        IF v_should_encrypt THEN
            NEW.secret_encrypted := encrypt_secret(NEW.secret);
            NEW.secret := NULL;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION auto_encrypt_organization_credentials() FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION auto_encrypt_email_tokens() FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION auto_encrypt_integration_config() FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION auto_encrypt_webhook_secret() FROM PUBLIC, authenticated;
