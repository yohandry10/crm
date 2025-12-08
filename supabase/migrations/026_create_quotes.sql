-- =====================================================
-- QUOTES (MULTI-TENANT)
-- =====================================================

CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    quote_number TEXT,
    status TEXT DEFAULT 'draft',
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'PEN',
    valid_until DATE,
    notes TEXT,
    terms TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL,
    total DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quotes_org ON quotes(organization_id);
CREATE INDEX idx_quotes_contact ON quotes(contact_id);
CREATE INDEX idx_quotes_opportunity ON quotes(opportunity_id);
CREATE INDEX idx_quote_items_quote ON quote_items(quote_id);

ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view quotes" ON quotes
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert quotes" ON quotes
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update quotes" ON quotes
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete quotes" ON quotes
    FOR DELETE USING (is_org_member(organization_id));

CREATE POLICY "Users can view quote items" ON quote_items
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND is_org_member(quotes.organization_id))
    );

CREATE POLICY "Users can insert quote items" ON quote_items
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND is_org_member(quotes.organization_id))
    );

CREATE POLICY "Users can update quote items" ON quote_items
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND is_org_member(quotes.organization_id))
    );

CREATE POLICY "Users can delete quote items" ON quote_items
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM quotes WHERE quotes.id = quote_items.quote_id AND is_org_member(quotes.organization_id))
    );
