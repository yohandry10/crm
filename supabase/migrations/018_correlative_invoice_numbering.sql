-- =====================================================
-- CORRELATIVE INVOICE NUMBERING (MULTI-TENANT)
-- =====================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS series VARCHAR(4) DEFAULT 'F001';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS correlative_number INTEGER;

-- Series por organización
CREATE TABLE IF NOT EXISTS invoice_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    series VARCHAR(4) NOT NULL,
    current_number INTEGER DEFAULT 0,
    prefix VARCHAR(10) DEFAULT 'F',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, series)
);

CREATE INDEX idx_invoice_series_org ON invoice_series(organization_id);

ALTER TABLE invoice_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view invoice_series" ON invoice_series
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can insert invoice_series" ON invoice_series
    FOR INSERT WITH CHECK (is_org_member(organization_id) AND get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can update invoice_series" ON invoice_series
    FOR UPDATE USING (get_org_role(organization_id) IN ('owner', 'admin'));

CREATE POLICY "Admins can delete invoice_series" ON invoice_series
    FOR DELETE USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- Función para obtener siguiente número (MULTI-TENANT)
CREATE OR REPLACE FUNCTION get_next_invoice_number(
    p_org_id UUID,
    p_series VARCHAR(4) DEFAULT 'F001'
)
RETURNS TEXT AS $$
DECLARE
    v_next_number INTEGER;
BEGIN
    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    INSERT INTO invoice_series (organization_id, series, current_number)
    VALUES (p_org_id, p_series, 0)
    ON CONFLICT (organization_id, series) DO NOTHING;

    UPDATE invoice_series
    SET current_number = current_number + 1, updated_at = NOW()
    WHERE organization_id = p_org_id AND series = p_series AND is_active = true
    RETURNING current_number INTO v_next_number;

    IF v_next_number IS NULL THEN
        RAISE EXCEPTION 'Serie % no activa para organización %', p_series, p_org_id;
    END IF;

    RETURN p_series || '-' || LPAD(v_next_number::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE INDEX IF NOT EXISTS idx_invoices_series_correlative ON invoices(organization_id, series, correlative_number);
