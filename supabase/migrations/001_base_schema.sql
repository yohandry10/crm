-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Create enum types
CREATE TYPE lead_status AS ENUM ('cold', 'warm', 'hot', 'converted', 'lost');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'manager', 'member', 'viewer');

-- =====================================================
-- MULTI-TENANT: Organizations (Tenants)
-- =====================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    ruc TEXT,
    legal_name TEXT,
    industry TEXT,
    website TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT DEFAULT 'Lima',
    country TEXT DEFAULT 'Perú',
    timezone TEXT DEFAULT 'America/Lima',
    currency TEXT DEFAULT 'PEN',
    logo_url TEXT,
    plan TEXT DEFAULT 'free',
    max_users INTEGER DEFAULT 3,
    max_contacts INTEGER DEFAULT 500,
    is_active BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_organizations_slug ON organizations(slug);

-- =====================================================
-- MULTI-TENANT: Organization Members
-- =====================================================
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'member',
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    invited_by UUID REFERENCES auth.users(id),
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- =====================================================
-- MULTI-TENANT: Organization Invitations
-- =====================================================
CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role org_role NOT NULL DEFAULT 'member',
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    status TEXT DEFAULT 'pending',
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, email)
);

CREATE INDEX idx_org_invitations_token ON organization_invitations(token) WHERE status = 'pending';

-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    current_organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_current_org ON profiles(current_organization_id);

-- Contacts table with AI features (MULTI-TENANT)
CREATE TABLE contacts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    assigned_to UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    ruc TEXT,
    company TEXT,
    position TEXT,
    address TEXT,
    city TEXT DEFAULT 'Lima',
    country TEXT DEFAULT 'Perú',
    lead_score FLOAT DEFAULT 0,
    lead_status lead_status DEFAULT 'cold',
    source TEXT,
    tags TEXT[],
    notes TEXT,
    last_interaction TIMESTAMP WITH TIME ZONE,
    interactions_count INTEGER DEFAULT 0,
    total_purchases DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_contacts_org ON contacts(organization_id);
CREATE INDEX idx_contacts_assigned ON contacts(assigned_to);

-- Interactions table for tracking contact history (MULTI-TENANT)
CREATE TABLE interactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    type TEXT NOT NULL,
    subject TEXT,
    description TEXT,
    outcome TEXT,
    next_action TEXT,
    next_action_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interactions_org ON interactions(organization_id);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);

-- Invoices table (MULTI-TENANT)
CREATE TABLE invoices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    invoice_number TEXT NOT NULL,
    status invoice_status DEFAULT 'draft',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    currency TEXT DEFAULT 'PEN',
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoices_org ON invoices(organization_id);

-- Invoice items
CREATE TABLE invoice_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Auditoria table (MULTI-TENANT)
CREATE TABLE auditoria (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  accion VARCHAR(100) NOT NULL,
  tabla VARCHAR(100),
  registro_id UUID,
  datos_anteriores JSONB,
  datos_nuevos JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auditoria_org ON auditoria(organization_id);

-- Chat messages for AI chatbot (MULTI-TENANT)
CREATE TABLE chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    response TEXT,
    is_ai_response BOOLEAN DEFAULT FALSE,
    context JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_org ON chat_messages(organization_id);

-- Automation workflows (MULTI-TENANT)
CREATE TABLE workflows (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflows_org ON workflows(organization_id);

-- Workflow executions log (MULTI-TENANT)
CREATE TABLE workflow_executions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    executed_actions JSONB,
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_org ON workflow_executions(organization_id);

-- Analytics cache table (MULTI-TENANT)
CREATE TABLE analytics_cache (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    metric_name TEXT NOT NULL,
    metric_value JSONB NOT NULL,
    period TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, metric_name, period, date)
);

CREATE INDEX idx_analytics_cache_org ON analytics_cache(organization_id);

-- Payments table (MULTI-TENANT)
CREATE TABLE payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    created_by UUID REFERENCES auth.users(id),
    amount DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'PEN',
    status payment_status DEFAULT 'pending',
    payment_method TEXT,
    transaction_id TEXT,
    gateway TEXT,
    metadata JSONB,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_payments_org ON payments(organization_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- Webhook events table (MULTI-TENANT)
CREATE TABLE webhook_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_webhook_events_org ON webhook_events(organization_id);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);

-- System health monitoring
CREATE TABLE system_health (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'healthy', 'degraded', 'down'
    response_time_ms INTEGER,
    error_message TEXT,
    metadata JSONB,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_system_health_service ON system_health(service_name);
CREATE INDEX idx_system_health_checked ON system_health(checked_at);
