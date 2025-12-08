-- =====================================================
-- MULTI-TENANT HELPER FUNCTIONS
-- =====================================================

-- Get current user's organization from session or profile
CREATE OR REPLACE FUNCTION get_current_organization_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_org_id UUID;
BEGIN
    -- Try session variable first
    BEGIN
        v_org_id := current_setting('app.current_organization_id', true)::UUID;
        IF v_org_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM organization_members 
                WHERE organization_id = v_org_id 
                AND user_id = auth.uid() 
                AND is_active = TRUE
            ) THEN
                RETURN v_org_id;
            END IF;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;
    
    -- Fallback to profile's current_organization_id
    SELECT current_organization_id INTO v_org_id
    FROM profiles WHERE id = auth.uid();
    
    IF v_org_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = v_org_id 
        AND user_id = auth.uid() 
        AND is_active = TRUE
    ) THEN
        RETURN v_org_id;
    END IF;
    
    -- Last fallback: first org
    SELECT organization_id INTO v_org_id
    FROM organization_members
    WHERE user_id = auth.uid() AND is_active = TRUE
    ORDER BY created_at ASC LIMIT 1;
    
    RETURN v_org_id;
END;
$$;

-- Check if user is member of organization
CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    IF p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN EXISTS (
        SELECT 1 FROM organization_members
        WHERE organization_id = p_org_id
        AND user_id = COALESCE(p_user_id, auth.uid())
        AND is_active = TRUE
    );
END;
$$;

-- Get user's role in organization
CREATE OR REPLACE FUNCTION get_org_role(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS org_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role org_role;
BEGIN
    IF p_org_id IS NULL THEN
        RETURN NULL;
    END IF;
    SELECT role INTO v_role
    FROM organization_members
    WHERE organization_id = p_org_id
    AND user_id = COALESCE(p_user_id, auth.uid())
    AND is_active = TRUE;
    RETURN v_role;
END;
$$;

-- Check permission
CREATE OR REPLACE FUNCTION has_org_permission(p_org_id UUID, p_permission TEXT, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role org_role;
    v_action TEXT;
BEGIN
    IF p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT role INTO v_role
    FROM organization_members
    WHERE organization_id = p_org_id AND user_id = COALESCE(p_user_id, auth.uid()) AND is_active = TRUE;
    
    IF v_role IS NULL THEN RETURN FALSE; END IF;
    
    v_action := split_part(p_permission, '.', 2);
    
    CASE v_role
        WHEN 'owner', 'admin' THEN RETURN TRUE;
        WHEN 'manager', 'member' THEN RETURN v_action IN ('read', 'write', 'create', 'update');
        WHEN 'viewer' THEN RETURN v_action = 'read';
        ELSE RETURN FALSE;
    END CASE;
END;
$$;

-- =====================================================
-- BUSINESS FUNCTIONS
-- =====================================================

-- Calculate lead score
CREATE OR REPLACE FUNCTION calculate_lead_score(p_contact_id UUID)
RETURNS FLOAT AS $$
DECLARE
    score FLOAT := 0;
    contact_record RECORD;
    interaction_count INTEGER;
    recent_interactions INTEGER;
    purchase_history DECIMAL;
BEGIN
    IF p_contact_id IS NULL THEN
        RETURN 0;
    END IF;

    SELECT * INTO contact_record FROM contacts WHERE id = p_contact_id;
    
    IF NOT FOUND THEN RETURN 0; END IF;
    
    IF contact_record.email IS NOT NULL THEN score := score + 10; END IF;
    IF contact_record.phone IS NOT NULL THEN score := score + 10; END IF;
    IF contact_record.ruc IS NOT NULL THEN score := score + 15; END IF;
    IF contact_record.company IS NOT NULL THEN score := score + 10; END IF;
    
    SELECT COUNT(*) INTO interaction_count 
    FROM interactions WHERE contact_id = p_contact_id;
    
    SELECT COUNT(*) INTO recent_interactions 
    FROM interactions 
    WHERE contact_id = p_contact_id AND created_at > NOW() - INTERVAL '30 days';
    
    score := score + LEAST(interaction_count * 2, 20) + LEAST(recent_interactions * 5, 25);
    
    SELECT COALESCE(SUM(total), 0) INTO purchase_history
    FROM invoices WHERE contact_id = p_contact_id AND status = 'paid';
    
    score := score + LEAST(purchase_history / 100, 20);
    
    IF contact_record.last_interaction > NOW() - INTERVAL '7 days' THEN
        score := score + 20;
    ELSIF contact_record.last_interaction > NOW() - INTERVAL '30 days' THEN
        score := score + 10;
    END IF;
    
    RETURN LEAST(score, 100);
END;
$$ LANGUAGE plpgsql STABLE;

-- Update lead score trigger function
CREATE OR REPLACE FUNCTION update_lead_score()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS NOT NULL AND NEW.contact_id IS NOT NULL THEN
        UPDATE contacts 
        SET lead_score = calculate_lead_score(NEW.contact_id), updated_at = NOW()
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Generate invoice number (MULTI-TENANT)
CREATE OR REPLACE FUNCTION generate_invoice_number(p_org_id UUID, invoice_type TEXT)
RETURNS TEXT AS $$
DECLARE
    prefix TEXT;
    sequence_num INTEGER;
    year_suffix TEXT;
BEGIN
    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    year_suffix := EXTRACT(YEAR FROM NOW())::TEXT;
    prefix := CASE WHEN invoice_type = 'factura' THEN 'F' ELSE 'B' END;
    
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM '[0-9]+') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE organization_id = p_org_id AND invoice_number LIKE prefix || '%' || year_suffix;
    
    RETURN prefix || LPAD(sequence_num::TEXT, 6, '0') || '-' || year_suffix;
END;
$$ LANGUAGE plpgsql;

-- Predict monthly sales (MULTI-TENANT)
CREATE OR REPLACE FUNCTION predict_monthly_sales(p_org_id UUID, months_ahead INTEGER DEFAULT 3)
RETURNS JSONB AS $$
DECLARE
    historical_data JSONB;
    prediction JSONB;
    last_month_sales DECIMAL;
    predicted_sales DECIMAL;
    i INTEGER;
BEGIN
    IF p_org_id IS NULL THEN
        RETURN jsonb_build_object('historical', '[]'::jsonb, 'predictions', '[]'::jsonb);
    END IF;

    SELECT jsonb_agg(
        jsonb_build_object('month', date_trunc('month', created_at), 'sales', SUM(total))
        ORDER BY date_trunc('month', created_at)
    ) INTO historical_data
    FROM invoices
    WHERE organization_id = p_org_id AND status = 'paid' AND created_at > NOW() - INTERVAL '12 months'
    GROUP BY date_trunc('month', created_at);
    
    SELECT AVG(total) INTO last_month_sales
    FROM invoices
    WHERE organization_id = p_org_id AND status = 'paid' AND created_at > NOW() - INTERVAL '1 month';
    
    predicted_sales := COALESCE(last_month_sales, 0);
    prediction := '[]'::jsonb;
    
    FOR i IN 1..months_ahead LOOP
        predicted_sales := predicted_sales * 1.05;
        prediction := prediction || jsonb_build_object(
            'month', (NOW() + (i || ' months')::INTERVAL),
            'predicted_sales', predicted_sales,
            'confidence', GREATEST(0.75 - (i * 0.1), 0.3)
        );
    END LOOP;
    
    RETURN jsonb_build_object('historical', COALESCE(historical_data, '[]'::jsonb), 'predictions', prediction);
END;
$$ LANGUAGE plpgsql STABLE;
