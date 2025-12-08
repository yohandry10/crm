-- ============================================
-- MIGRACIÓN 051: Formularios Web Embebibles
-- ============================================
-- Sistema para crear formularios y capturar leads desde sitios externos

-- ============================================
-- TABLA: Formularios Web
-- ============================================
CREATE TABLE IF NOT EXISTS web_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Identificación
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL, -- URL amigable: tucrm.com/f/contacto
    description TEXT,
    
    -- Configuración
    fields JSONB NOT NULL DEFAULT '[]', -- Array de campos del formulario
    settings JSONB DEFAULT '{}', -- Configuraciones adicionales
    
    -- Estilo
    theme JSONB DEFAULT '{"primaryColor": "#3b82f6", "backgroundColor": "#ffffff"}',
    custom_css TEXT,
    
    -- Comportamiento post-envío
    redirect_url TEXT, -- URL a redirigir después de enviar
    success_message TEXT DEFAULT '¡Gracias! Hemos recibido tu información.',
    
    -- Automatización
    auto_create_contact BOOLEAN DEFAULT true,
    default_lead_status VARCHAR(20) DEFAULT 'warm',
    default_lead_source VARCHAR(50) DEFAULT 'web_form',
    default_tags TEXT[] DEFAULT '{}',
    assigned_to UUID REFERENCES auth.users(id), -- Asignar leads automáticamente
    
    -- Notificaciones
    notify_emails TEXT[], -- Emails a notificar cuando hay envío
    notify_on_submit BOOLEAN DEFAULT true,
    
    -- Estado
    is_active BOOLEAN DEFAULT true,
    
    -- Métricas
    views_count INTEGER DEFAULT 0,
    submissions_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE UNIQUE INDEX idx_web_forms_slug ON web_forms(organization_id, slug);
CREATE INDEX idx_web_forms_org ON web_forms(organization_id);
CREATE INDEX idx_web_forms_active ON web_forms(organization_id, is_active);

-- RLS
ALTER TABLE web_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "web_forms_org_isolation" ON web_forms
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- ============================================
-- TABLA: Envíos de Formularios
-- ============================================
CREATE TABLE IF NOT EXISTS form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    form_id UUID NOT NULL REFERENCES web_forms(id) ON DELETE CASCADE,
    
    -- Datos del envío
    data JSONB NOT NULL, -- Datos del formulario
    
    -- Contacto creado (si aplica)
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    
    -- Estado
    status VARCHAR(20) DEFAULT 'new', -- new, processed, spam
    processed_at TIMESTAMPTZ,
    processed_by UUID REFERENCES auth.users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_form_submissions_org ON form_submissions(organization_id);
CREATE INDEX idx_form_submissions_form ON form_submissions(form_id);
CREATE INDEX idx_form_submissions_contact ON form_submissions(contact_id);
CREATE INDEX idx_form_submissions_status ON form_submissions(organization_id, status);
CREATE INDEX idx_form_submissions_created ON form_submissions(created_at DESC);

-- RLS
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_submissions_org_isolation" ON form_submissions
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- ============================================
-- FUNCIÓN: Procesar envío de formulario
-- ============================================
CREATE OR REPLACE FUNCTION process_form_submission(
    p_form_id UUID,
    p_data JSONB,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_referrer TEXT DEFAULT NULL,
    p_utm_source VARCHAR DEFAULT NULL,
    p_utm_medium VARCHAR DEFAULT NULL,
    p_utm_campaign VARCHAR DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_form web_forms%ROWTYPE;
    v_submission_id UUID;
    v_contact_id UUID;
    v_email TEXT;
    v_name TEXT;
    v_phone TEXT;
BEGIN
    -- Obtener formulario
    SELECT * INTO v_form FROM web_forms WHERE id = p_form_id AND is_active = true;
    
    IF v_form.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Formulario no encontrado o inactivo');
    END IF;
    
    -- Crear submission
    INSERT INTO form_submissions (
        organization_id, form_id, data, ip_address, user_agent, 
        referrer, utm_source, utm_medium, utm_campaign
    ) VALUES (
        v_form.organization_id, p_form_id, p_data, p_ip_address, p_user_agent,
        p_referrer, p_utm_source, p_utm_medium, p_utm_campaign
    ) RETURNING id INTO v_submission_id;
    
    -- Actualizar contador
    UPDATE web_forms SET submissions_count = submissions_count + 1 WHERE id = p_form_id;
    
    -- Crear contacto si está habilitado
    IF v_form.auto_create_contact THEN
        -- Extraer campos comunes del data
        v_email := p_data->>'email';
        v_name := COALESCE(p_data->>'name', p_data->>'nombre', p_data->>'full_name');
        v_phone := COALESCE(p_data->>'phone', p_data->>'telefono', p_data->>'tel');
        
        IF v_email IS NOT NULL OR v_name IS NOT NULL THEN
            -- Verificar si ya existe contacto con ese email
            IF v_email IS NOT NULL THEN
                SELECT id INTO v_contact_id FROM contacts 
                WHERE organization_id = v_form.organization_id AND email = v_email
                LIMIT 1;
            END IF;
            
            -- Crear nuevo contacto si no existe
            IF v_contact_id IS NULL THEN
                INSERT INTO contacts (
                    organization_id,
                    name,
                    email,
                    phone,
                    lead_status,
                    source,
                    tags,
                    assigned_to,
                    notes
                ) VALUES (
                    v_form.organization_id,
                    COALESCE(v_name, 'Sin nombre'),
                    v_email,
                    v_phone,
                    v_form.default_lead_status::lead_status,
                    v_form.default_lead_source,
                    v_form.default_tags,
                    v_form.assigned_to,
                    'Capturado desde formulario: ' || v_form.name
                ) RETURNING id INTO v_contact_id;
            END IF;
            
            -- Vincular submission con contacto
            UPDATE form_submissions SET contact_id = v_contact_id WHERE id = v_submission_id;
        END IF;
    END IF;
    
    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission_id,
        'contact_id', v_contact_id,
        'message', v_form.success_message,
        'redirect_url', v_form.redirect_url
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCIÓN: Incrementar vistas de formulario
-- ============================================
CREATE OR REPLACE FUNCTION increment_form_views(p_form_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE web_forms SET views_count = views_count + 1 WHERE id = p_form_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Comentarios
-- ============================================
COMMENT ON TABLE web_forms IS 'Formularios web embebibles para captura de leads';
COMMENT ON TABLE form_submissions IS 'Envíos de formularios web';
COMMENT ON COLUMN web_forms.fields IS 'Array JSON de campos: [{id, type, label, required, options, placeholder}]';
COMMENT ON COLUMN web_forms.settings IS 'Configuraciones: {doubleOptIn, captcha, honeypot}';
