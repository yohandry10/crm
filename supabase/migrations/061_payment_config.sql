-- =====================================================
-- MIGRATION: Payment Configuration + Quote-to-Invoice Link
-- Adds payment methods config to organizations and links quotes to invoices
-- =====================================================

-- 1. Add payment configuration to organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS yape_phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS yape_qr_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plin_phone TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plin_qr_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_cci TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bank_holder TEXT;

-- 2. Add quote reference to invoices (for quote-to-invoice conversion)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);

-- 3. Add proof of payment fields to payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_url TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ;

-- 4. Add new quote statuses (expired, converted)
-- First check if enum values exist before adding
DO $$
BEGIN
    -- Check if quotes table has a status column that needs updating
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quotes' AND column_name = 'status') THEN
        -- Add new status values if they don't exist
        -- Since quotes uses TEXT not ENUM, we just need to document valid values:
        -- draft, sent, accepted, rejected, expired, converted, cancelled
        COMMENT ON COLUMN quotes.status IS 'Valid values: draft, sent, accepted, rejected, expired, converted, cancelled';
    END IF;
END $$;

-- 5. Add rejected status to payments (already uses payment_status enum)
-- Check if 'rejected' exists in payment_status enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected' AND enumtypid = 'payment_status'::regtype) THEN
        ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'rejected';
    END IF;
END $$;

-- 6. Comments for documentation
COMMENT ON COLUMN organizations.yape_phone IS 'Phone number for Yape payments';
COMMENT ON COLUMN organizations.yape_qr_url IS 'URL to Yape QR code image';
COMMENT ON COLUMN organizations.plin_phone IS 'Phone number for Plin payments';
COMMENT ON COLUMN organizations.plin_qr_url IS 'URL to Plin QR code image';
COMMENT ON COLUMN organizations.bank_name IS 'Bank name for transfers (e.g., BCP, Interbank)';
COMMENT ON COLUMN organizations.bank_account IS 'Bank account number';
COMMENT ON COLUMN organizations.bank_cci IS 'Código de Cuenta Interbancario (CCI)';
COMMENT ON COLUMN organizations.bank_holder IS 'Bank account holder name';
COMMENT ON COLUMN invoices.quote_id IS 'Reference to the quote this invoice was generated from';
COMMENT ON COLUMN payments.proof_url IS 'URL to payment proof image (transfer screenshot)';
COMMENT ON COLUMN payments.proof_uploaded_at IS 'Timestamp when proof was uploaded';
