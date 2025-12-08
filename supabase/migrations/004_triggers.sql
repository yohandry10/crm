-- =====================================================
-- TRIGGERS (MULTI-TENANT)
-- =====================================================

-- Trigger to update lead score when interactions change
CREATE TRIGGER update_lead_score_on_interaction
    AFTER INSERT OR UPDATE ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_lead_score();

-- Trigger to update contact last_interaction
CREATE OR REPLACE FUNCTION update_contact_last_interaction()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS NOT NULL AND NEW.contact_id IS NOT NULL THEN
        UPDATE contacts 
        SET last_interaction = NOW(),
            interactions_count = interactions_count + 1,
            updated_at = NOW()
        WHERE id = NEW.contact_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contact_interaction_trigger
    AFTER INSERT ON interactions
    FOR EACH ROW
    EXECUTE FUNCTION update_contact_last_interaction();

-- Trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_org_members_updated_at BEFORE UPDATE ON organization_members
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create owner membership when organization is created
CREATE OR REPLACE FUNCTION handle_new_organization()
RETURNS TRIGGER AS $$
BEGIN
    -- Only create membership if created_by is set
    IF NEW IS NOT NULL AND NEW.created_by IS NOT NULL THEN
        INSERT INTO organization_members (organization_id, user_id, role, is_active, accepted_at)
        VALUES (NEW.id, NEW.created_by, 'owner', TRUE, NOW())
        ON CONFLICT (organization_id, user_id) DO NOTHING;
        
        UPDATE profiles SET current_organization_id = NEW.id
        WHERE id = NEW.created_by AND current_organization_id IS NULL;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created
    AFTER INSERT ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_organization();

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW IS NOT NULL THEN
        INSERT INTO profiles (id, email, full_name)
        VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
        ON CONFLICT (id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
