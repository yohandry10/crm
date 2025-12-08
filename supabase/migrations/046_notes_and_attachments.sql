-- ============================================
-- MIGRACIÓN 046: Notas y Archivos Adjuntos
-- ============================================

-- ============================================
-- TABLA: Notas/Comentarios
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Entidad relacionada (polimórfico)
    entity_type VARCHAR(50) NOT NULL, -- contact, account, opportunity, invoice, task, ticket
    entity_id UUID NOT NULL,
    
    -- Contenido
    content TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT false,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_notes_org ON notes(organization_id);
CREATE INDEX idx_notes_entity ON notes(entity_type, entity_id);
CREATE INDEX idx_notes_created ON notes(created_at DESC);

-- RLS
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notes_org_isolation" ON notes
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- ============================================
-- TABLA: Archivos Adjuntos
-- ============================================
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Entidad relacionada
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    
    -- Info del archivo
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100), -- mime type
    file_size INTEGER, -- bytes
    file_url TEXT NOT NULL, -- URL en storage
    storage_path TEXT, -- path en bucket
    
    -- Metadata
    description TEXT,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_attachments_org ON attachments(organization_id);
CREATE INDEX idx_attachments_entity ON attachments(entity_type, entity_id);

-- RLS
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_org_isolation" ON attachments
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- ============================================
-- TABLA: Favoritos/Marcadores
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Entidad marcada
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255), -- Para mostrar sin join
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un usuario solo puede marcar una vez cada entidad
    UNIQUE(user_id, entity_type, entity_id)
);

-- Índices
CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_entity ON favorites(entity_type, entity_id);

-- RLS
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favorites_user_only" ON favorites
    FOR ALL USING (user_id = auth.uid());

-- ============================================
-- TABLA: Recordatorios
-- ============================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Entidad relacionada (opcional)
    entity_type VARCHAR(50),
    entity_id UUID,
    entity_name VARCHAR(255),
    
    -- Recordatorio
    title VARCHAR(255) NOT NULL,
    description TEXT,
    remind_at TIMESTAMPTZ NOT NULL,
    
    -- Estado
    is_completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    is_sent BOOLEAN DEFAULT false, -- Si ya se envió la notificación
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_reminders_user ON reminders(user_id);
CREATE INDEX idx_reminders_pending ON reminders(user_id, is_completed, remind_at);
CREATE INDEX idx_reminders_to_send ON reminders(is_sent, is_completed, remind_at);

-- RLS
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reminders_user_only" ON reminders
    FOR ALL USING (user_id = auth.uid());

-- ============================================
-- Vista: Notas con info de usuario
-- ============================================
CREATE OR REPLACE VIEW notes_with_user AS
SELECT 
    n.*,
    p.full_name as author_name,
    p.email as author_email,
    p.avatar_url as author_avatar
FROM notes n
LEFT JOIN profiles p ON n.created_by = p.id;

-- ============================================
-- Función: Buscar duplicados de contacto
-- ============================================
CREATE OR REPLACE FUNCTION find_duplicate_contacts(
    p_organization_id UUID,
    p_email VARCHAR DEFAULT NULL,
    p_phone VARCHAR DEFAULT NULL,
    p_name VARCHAR DEFAULT NULL,
    p_exclude_id UUID DEFAULT NULL
) RETURNS TABLE (
    id UUID,
    name VARCHAR,
    email VARCHAR,
    phone VARCHAR,
    match_type VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        c.id,
        c.name,
        c.email,
        c.phone,
        CASE 
            WHEN c.email = p_email AND p_email IS NOT NULL THEN 'email'
            WHEN c.phone = p_phone AND p_phone IS NOT NULL THEN 'phone'
            WHEN LOWER(c.name) = LOWER(p_name) AND p_name IS NOT NULL THEN 'name'
        END as match_type
    FROM contacts c
    WHERE c.organization_id = p_organization_id
      AND (p_exclude_id IS NULL OR c.id != p_exclude_id)
      AND (
          (p_email IS NOT NULL AND c.email = p_email)
          OR (p_phone IS NOT NULL AND c.phone = p_phone)
          OR (p_name IS NOT NULL AND LOWER(c.name) = LOWER(p_name))
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comentarios
-- ============================================
COMMENT ON TABLE notes IS 'Notas y comentarios en cualquier entidad del CRM';
COMMENT ON TABLE attachments IS 'Archivos adjuntos a entidades';
COMMENT ON TABLE favorites IS 'Entidades marcadas como favoritas por usuarios';
COMMENT ON TABLE reminders IS 'Recordatorios programados por usuarios';
