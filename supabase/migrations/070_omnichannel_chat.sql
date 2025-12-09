-- =====================================================
-- OMNICHANNEL INBOX SCHEMA
-- =====================================================

-- Enums
CREATE TYPE channel_type AS ENUM ('whatsapp', 'email', 'messenger', 'instagram', 'webchat');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status AS ENUM ('sent', 'delivered', 'read', 'failed');
CREATE TYPE conversation_status AS ENUM ('open', 'closed', 'snoozed');

-- 1. Channels (Configuración de conexiones)
CREATE TABLE channels (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Ventas WhatsApp", "Soporte Email"
    type channel_type NOT NULL,
    identifier TEXT NOT NULL, -- e.g. Phone Number, Email Address
    provider_config JSONB DEFAULT '{}', -- API Keys, Tokens (Encrypted ideally)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_channels_org ON channels(organization_id);

-- 2. Conversations (Hilos de chat)
CREATE TABLE conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    assigned_to UUID REFERENCES auth.users(id), -- Agente responsable
    status conversation_status DEFAULT 'open',
    subject TEXT, -- Para emails o asuntos
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unread_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}', -- Etiquetas, contexto AI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_org ON conversations(organization_id);
CREATE INDEX idx_conversations_contact ON conversations(contact_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_at DESC);

-- 3. Messages (Mensajes individuales)
CREATE TABLE messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES auth.users(id), -- Null si es el cliente externo
    direction message_direction NOT NULL,
    content TEXT, -- Contenido texto
    content_type TEXT DEFAULT 'text', -- text, image, file, template, note
    attachments JSONB DEFAULT '[]', -- Array de URLs o metadata de archivos
    status message_status DEFAULT 'sent',
    external_id TEXT, -- ID en WhatsApp/Provider
    metadata JSONB DEFAULT '{}', -- AI sentiment, template params
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_org ON messages(organization_id);
CREATE INDEX idx_messages_conv ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- =====================================================
-- RLS POLICIES (MULTI-TENANT)
-- =====================================================

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Channels Policies
CREATE POLICY "Org members can view channels" ON channels
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Admins can manage channels" ON channels
    FOR ALL USING (get_org_role(organization_id) IN ('owner', 'admin'));

-- Conversations Policies
CREATE POLICY "Org members can view conversations" ON conversations
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can manage conversations" ON conversations
    FOR ALL USING (is_org_member(organization_id));

-- Messages Policies
CREATE POLICY "Org members can view messages" ON messages
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert messages" ON messages
    FOR INSERT WITH CHECK (is_org_member(organization_id));

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Auto-update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_conversation_timestamp
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_timestamp();
