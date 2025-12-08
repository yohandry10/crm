-- Migration: New Features Tables
-- WhatsApp, Calendar, Webhooks, Email Sync, Reports

-- =====================================================
-- WHATSAPP MESSAGES
-- =====================================================
CREATE TABLE IF NOT EXISTS whatsapp_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT NOT NULL DEFAULT 'text',
    content TEXT NOT NULL,
    whatsapp_message_id TEXT,
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
    sent_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_whatsapp_messages_org ON whatsapp_messages(organization_id);
CREATE INDEX idx_whatsapp_messages_contact ON whatsapp_messages(contact_id);
CREATE INDEX idx_whatsapp_messages_phone ON whatsapp_messages(phone_number);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages_org_isolation" ON whatsapp_messages
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- CALENDAR EVENTS
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    location TEXT,
    event_type TEXT DEFAULT 'meeting' CHECK (event_type IN ('meeting', 'call', 'task', 'other')),
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    attendees JSONB DEFAULT '[]',
    meeting_link TEXT,
    reminder_minutes INTEGER DEFAULT 15,
    booking_data JSONB,
    google_event_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendar_events_org ON calendar_events(organization_id);
CREATE INDEX idx_calendar_events_owner ON calendar_events(owner_id);
CREATE INDEX idx_calendar_events_time ON calendar_events(start_time, end_time);
CREATE INDEX idx_calendar_events_contact ON calendar_events(contact_id);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "calendar_events_org_isolation" ON calendar_events
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- BOOKING CONFIGS
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 30,
    buffer INTEGER DEFAULT 10,
    available_days INTEGER[] DEFAULT '{1,2,3,4,5}',
    available_hours JSONB DEFAULT '{"start": "09:00", "end": "18:00"}',
    max_advance_days INTEGER DEFAULT 30,
    questions JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_booking_configs_org ON booking_configs(organization_id);
CREATE INDEX idx_booking_configs_owner ON booking_configs(owner_id);

ALTER TABLE booking_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "booking_configs_org_isolation" ON booking_configs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Public read for booking pages
CREATE POLICY "booking_configs_public_read" ON booking_configs
    FOR SELECT USING (is_active = true);

-- =====================================================
-- WEBHOOKS
-- =====================================================
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT[] NOT NULL,
    secret TEXT NOT NULL,
    headers JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhooks_org ON webhooks(organization_id);
CREATE INDEX idx_webhooks_active ON webhooks(organization_id, is_active);

ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_org_isolation" ON webhooks
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- WEBHOOK DELIVERIES
-- =====================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    payload JSONB,
    response_status INTEGER,
    response_body TEXT,
    error TEXT,
    success BOOLEAN DEFAULT false,
    delivered_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_time ON webhook_deliveries(delivered_at DESC);

ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_deliveries_via_webhook" ON webhook_deliveries
    FOR ALL USING (
        webhook_id IN (
            SELECT id FROM webhooks WHERE organization_id IN (
                SELECT organization_id FROM organization_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- =====================================================
-- EMAIL ACCOUNTS
-- =====================================================
CREATE TABLE IF NOT EXISTS email_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook')),
    email TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email)
);

CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "email_accounts_user_only" ON email_accounts
    FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- SYNCED EMAILS
-- =====================================================
CREATE TABLE IF NOT EXISTS synced_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    external_id TEXT NOT NULL UNIQUE,
    thread_id TEXT,
    from_email TEXT NOT NULL,
    to_emails TEXT[] NOT NULL,
    subject TEXT,
    body_preview TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN DEFAULT false,
    direction TEXT DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_synced_emails_org ON synced_emails(organization_id);
CREATE INDEX idx_synced_emails_user ON synced_emails(user_id);
CREATE INDEX idx_synced_emails_contact ON synced_emails(contact_id);
CREATE INDEX idx_synced_emails_time ON synced_emails(received_at DESC);

ALTER TABLE synced_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "synced_emails_user_only" ON synced_emails
    FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- SAVED REPORTS
-- =====================================================
CREATE TABLE IF NOT EXISTS saved_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    config JSONB NOT NULL,
    is_public BOOLEAN DEFAULT false,
    schedule TEXT, -- cron expression for scheduled reports
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_reports_org ON saved_reports(organization_id);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "saved_reports_org_isolation" ON saved_reports
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- =====================================================
-- ADD LEAD SCORE TO CONTACTS
-- =====================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_score_factors JSONB;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_interaction_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_contacts_lead_score ON contacts(organization_id, lead_score DESC);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT unnest(ARRAY[
            'whatsapp_messages', 'calendar_events', 'booking_configs', 
            'webhooks', 'email_accounts', 'saved_reports'
        ])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS update_%s_updated_at ON %s;
            CREATE TRIGGER update_%s_updated_at
                BEFORE UPDATE ON %s
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', t, t, t, t);
    END LOOP;
END $$;
