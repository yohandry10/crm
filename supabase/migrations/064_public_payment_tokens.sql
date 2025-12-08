-- =====================================================
-- MIGRATION: Public Payment Token System
-- =====================================================

-- Table to store secure tokens for public quote/payment access
CREATE TABLE IF NOT EXISTS public_payment_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    is_active BOOLEAN DEFAULT TRUE,
    accessed_at TIMESTAMPTZ,
    access_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Either quote_id or invoice_id must be set
    CONSTRAINT check_quote_or_invoice CHECK (quote_id IS NOT NULL OR invoice_id IS NOT NULL)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_tokens_token ON public_payment_tokens(token) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_payment_tokens_quote ON public_payment_tokens(quote_id);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_invoice ON public_payment_tokens(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_tokens_expires ON public_payment_tokens(expires_at) WHERE is_active = TRUE;

-- RLS Policies (allow public read with valid token, org members can manage)
ALTER TABLE public_payment_tokens ENABLE ROW LEVEL SECURITY;

-- Org members can manage tokens
CREATE POLICY "Org members can manage payment tokens"
ON public_payment_tokens FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM organization_members om
        WHERE om.user_id = auth.uid()
        AND om.organization_id = public_payment_tokens.organization_id
    )
);

-- Function to generate a public payment link
CREATE OR REPLACE FUNCTION generate_payment_token(
    p_organization_id UUID,
    p_quote_id UUID DEFAULT NULL,
    p_invoice_id UUID DEFAULT NULL,
    p_expires_days INTEGER DEFAULT 30
)
RETURNS TEXT AS $$
DECLARE
    v_token TEXT;
BEGIN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON TABLE public_payment_tokens IS 'Secure tokens for public quote/payment page access';
COMMENT ON FUNCTION generate_payment_token IS 'Generate a secure token for public payment page access';
