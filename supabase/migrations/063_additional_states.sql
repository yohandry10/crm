-- =====================================================
-- MIGRATION: Additional States for Quotes and Payments
-- =====================================================

-- Add comment documenting valid quote statuses
-- (quotes.status is TEXT, not ENUM, so we just document)
COMMENT ON COLUMN quotes.status IS 'Valid values: draft, sent, accepted, rejected, expired, converted, cancelled';

-- Ensure payment_status enum has all needed values
DO $$
BEGIN
    -- Add 'rejected' if not exists
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected' AND enumtypid = 'payment_status'::regtype) THEN
        ALTER TYPE payment_status ADD VALUE 'rejected';
    END IF;
END $$;

-- Add payment verification fields
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES auth.users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add quote expiry tracking
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS converted_invoice_id UUID REFERENCES invoices(id);

-- Create index for finding expired quotes
CREATE INDEX IF NOT EXISTS idx_quotes_valid_until ON quotes(valid_until) WHERE status = 'sent';

-- Function to auto-expire quotes (can be called by cron)
CREATE OR REPLACE FUNCTION expire_overdue_quotes()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE quotes
    SET status = 'expired', expired_at = NOW(), updated_at = NOW()
    WHERE status = 'sent'
      AND valid_until IS NOT NULL
      AND valid_until < CURRENT_DATE;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments for documentation
COMMENT ON COLUMN payments.verified_by IS 'User who verified/rejected the payment';
COMMENT ON COLUMN payments.verified_at IS 'Timestamp when payment was verified';
COMMENT ON COLUMN payments.rejection_reason IS 'Reason for payment rejection';
COMMENT ON COLUMN quotes.expired_at IS 'When the quote was marked as expired';
COMMENT ON COLUMN quotes.converted_at IS 'When the quote was converted to invoice';
COMMENT ON COLUMN quotes.converted_invoice_id IS 'Reference to the invoice created from this quote';
COMMENT ON FUNCTION expire_overdue_quotes() IS 'Mark quotes as expired if past valid_until date. Returns count of expired quotes.';
