-- =====================================================
-- EVENTS/CALENDAR (MULTI-TENANT)
-- =====================================================

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    all_day BOOLEAN DEFAULT FALSE,
    location TEXT,
    meeting_link TEXT,
    attendees JSONB DEFAULT '[]',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_org ON events(organization_id);
CREATE INDEX idx_events_org_time ON events(organization_id, start_time);
CREATE INDEX idx_events_contact ON events(contact_id);
CREATE INDEX idx_events_opportunity ON events(opportunity_id);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view events" ON events
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert events" ON events
    FOR INSERT WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update events" ON events
    FOR UPDATE USING (is_org_member(organization_id));

CREATE POLICY "Org members can delete events" ON events
    FOR DELETE USING (is_org_member(organization_id));
