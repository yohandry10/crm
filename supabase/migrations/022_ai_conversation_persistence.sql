-- =====================================================
-- AI CONVERSATIONS (MULTI-TENANT)
-- =====================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    tokens_used INTEGER,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_org ON ai_conversations(organization_id);
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id, updated_at DESC);
CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON ai_conversations
    FOR SELECT USING (auth.uid() = user_id AND is_org_member(organization_id));

CREATE POLICY "Users can insert own conversations" ON ai_conversations
    FOR INSERT WITH CHECK (auth.uid() = user_id AND is_org_member(organization_id));

CREATE POLICY "Users can update own conversations" ON ai_conversations
    FOR UPDATE USING (auth.uid() = user_id AND is_org_member(organization_id));

CREATE POLICY "Users can delete own conversations" ON ai_conversations
    FOR DELETE USING (auth.uid() = user_id AND is_org_member(organization_id));

CREATE POLICY "Users can view messages in own conversations" ON ai_messages
    FOR SELECT USING (
        conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert messages in own conversations" ON ai_messages
    FOR INSERT WITH CHECK (
        conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = auth.uid())
    );

-- Get or create conversation
CREATE OR REPLACE FUNCTION get_or_create_conversation(p_org_id UUID, p_user_id UUID, p_title TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    IF p_org_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'organization_id and user_id are required';
    END IF;

    SELECT id INTO v_conversation_id
    FROM ai_conversations
    WHERE organization_id = p_org_id AND user_id = p_user_id AND updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC LIMIT 1;
    
    IF v_conversation_id IS NULL THEN
        INSERT INTO ai_conversations (organization_id, user_id, title)
        VALUES (p_org_id, p_user_id, COALESCE(p_title, 'Nueva conversación'))
        RETURNING id INTO v_conversation_id;
    END IF;
    
    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add message to conversation
CREATE OR REPLACE FUNCTION add_ai_message(
    p_conversation_id UUID,
    p_role TEXT,
    p_content TEXT,
    p_metadata JSONB DEFAULT NULL,
    p_tokens_used INTEGER DEFAULT NULL,
    p_model TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_message_id UUID;
BEGIN
    IF p_conversation_id IS NULL OR p_role IS NULL OR p_content IS NULL THEN
        RAISE EXCEPTION 'conversation_id, role, and content are required';
    END IF;

    INSERT INTO ai_messages (conversation_id, role, content, metadata, tokens_used, model)
    VALUES (p_conversation_id, p_role, p_content, COALESCE(p_metadata, '{}'::jsonb), p_tokens_used, p_model)
    RETURNING id INTO v_message_id;
    
    UPDATE ai_conversations SET updated_at = NOW(),
        title = CASE WHEN title IS NULL OR title = 'Nueva conversación' 
                THEN substring(p_content, 1, 50) || '...' ELSE title END
    WHERE id = p_conversation_id;
    
    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
