-- ============================================
-- MIGRACIÓN 045: Sistema de Activity Logs
-- ============================================
-- Registra todas las actividades y cambios en el CRM
-- para auditoría y timeline de contactos/cuentas

-- Tabla principal de activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Tipo de actividad
    action VARCHAR(50) NOT NULL, -- create, update, delete, view, login, export, import, etc.
    entity_type VARCHAR(50) NOT NULL, -- contact, account, opportunity, invoice, task, ticket, etc.
    entity_id UUID, -- ID del registro afectado
    entity_name VARCHAR(255), -- Nombre/título para mostrar sin hacer join
    
    -- Detalles del cambio
    description TEXT, -- Descripción legible: "Creó el contacto Juan Pérez"
    changes JSONB, -- { field: { old: "valor1", new: "valor2" } }
    metadata JSONB, -- Datos adicionales según el tipo de acción
    
    -- Contexto
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_activity_logs_org ON activity_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- Índice compuesto para timeline de entidad
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_timeline 
ON activity_logs(organization_id, entity_type, entity_id, created_at DESC);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Política: usuarios solo ven logs de su organización
DROP POLICY IF EXISTS "activity_logs_org_isolation" ON activity_logs;
CREATE POLICY "activity_logs_org_isolation" ON activity_logs
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- ============================================
-- Vista para activity logs con info de usuario
-- ============================================
CREATE OR REPLACE VIEW activity_logs_with_user AS
SELECT 
    al.*,
    p.full_name as user_name,
    p.email as user_email,
    p.avatar_url as user_avatar
FROM activity_logs al
LEFT JOIN profiles p ON al.user_id = p.id;

-- ============================================
-- Función para registrar actividad
-- ============================================
CREATE OR REPLACE FUNCTION log_activity(
    p_organization_id UUID,
    p_user_id UUID,
    p_action VARCHAR(50),
    p_entity_type VARCHAR(50),
    p_entity_id UUID DEFAULT NULL,
    p_entity_name VARCHAR(255) DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_changes JSONB DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO activity_logs (
        organization_id,
        user_id,
        action,
        entity_type,
        entity_id,
        entity_name,
        description,
        changes,
        metadata
    ) VALUES (
        p_organization_id,
        p_user_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_entity_name,
        p_description,
        p_changes,
        p_metadata
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Triggers automáticos para entidades principales
-- ============================================

-- Trigger para contacts
CREATE OR REPLACE FUNCTION trigger_log_contact_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(50);
    v_description TEXT;
    v_changes JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_description := 'Creó el contacto ' || NEW.name;
        
        PERFORM log_activity(
            NEW.organization_id,
            auth.uid(),
            v_action,
            'contact',
            NEW.id,
            NEW.name,
            v_description,
            NULL,
            jsonb_build_object('email', NEW.email, 'phone', NEW.phone)
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_changes := '{}'::jsonb;
        
        -- Detectar cambios en campos importantes
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        END IF;
        IF OLD.email IS DISTINCT FROM NEW.email THEN
            v_changes := v_changes || jsonb_build_object('email', jsonb_build_object('old', OLD.email, 'new', NEW.email));
        END IF;
        IF OLD.phone IS DISTINCT FROM NEW.phone THEN
            v_changes := v_changes || jsonb_build_object('phone', jsonb_build_object('old', OLD.phone, 'new', NEW.phone));
        END IF;
        IF OLD.lead_status IS DISTINCT FROM NEW.lead_status THEN
            v_changes := v_changes || jsonb_build_object('lead_status', jsonb_build_object('old', OLD.lead_status, 'new', NEW.lead_status));
        END IF;
        
        -- Solo registrar si hubo cambios
        IF v_changes != '{}'::jsonb THEN
            v_description := 'Actualizó el contacto ' || NEW.name;
            
            PERFORM log_activity(
                NEW.organization_id,
                auth.uid(),
                v_action,
                'contact',
                NEW.id,
                NEW.name,
                v_description,
                v_changes,
                NULL
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        v_action := 'delete';
        v_description := 'Eliminó el contacto ' || OLD.name;
        
        PERFORM log_activity(
            OLD.organization_id,
            auth.uid(),
            v_action,
            'contact',
            OLD.id,
            OLD.name,
            v_description,
            NULL,
            jsonb_build_object('email', OLD.email)
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger en contacts
DROP TRIGGER IF EXISTS trigger_contact_activity ON contacts;
CREATE TRIGGER trigger_contact_activity
    AFTER INSERT OR UPDATE OR DELETE ON contacts
    FOR EACH ROW EXECUTE FUNCTION trigger_log_contact_changes();

-- Trigger para opportunities
CREATE OR REPLACE FUNCTION trigger_log_opportunity_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_action VARCHAR(50);
    v_description TEXT;
    v_changes JSONB;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_action := 'create';
        v_description := 'Creó la oportunidad ' || NEW.name;
        
        PERFORM log_activity(
            NEW.organization_id,
            auth.uid(),
            v_action,
            'opportunity',
            NEW.id,
            NEW.name,
            v_description,
            NULL,
            jsonb_build_object('amount', NEW.amount, 'stage_id', NEW.stage_id)
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_changes := '{}'::jsonb;
        
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        END IF;
        IF OLD.amount IS DISTINCT FROM NEW.amount THEN
            v_changes := v_changes || jsonb_build_object('amount', jsonb_build_object('old', OLD.amount, 'new', NEW.amount));
        END IF;
        IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
            v_changes := v_changes || jsonb_build_object('stage_id', jsonb_build_object('old', OLD.stage_id, 'new', NEW.stage_id));
        END IF;
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            v_changes := v_changes || jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status));
        END IF;
        
        IF v_changes != '{}'::jsonb THEN
            v_description := 'Actualizó la oportunidad ' || NEW.name;
            
            PERFORM log_activity(
                NEW.organization_id,
                auth.uid(),
                v_action,
                'opportunity',
                NEW.id,
                NEW.name,
                v_description,
                v_changes,
                NULL
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_activity(
            OLD.organization_id,
            auth.uid(),
            'delete',
            'opportunity',
            OLD.id,
            OLD.name,
            'Eliminó la oportunidad ' || OLD.name,
            NULL,
            NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_opportunity_activity ON opportunities;
CREATE TRIGGER trigger_opportunity_activity
    AFTER INSERT OR UPDATE OR DELETE ON opportunities
    FOR EACH ROW EXECUTE FUNCTION trigger_log_opportunity_changes();

-- Trigger para invoices
CREATE OR REPLACE FUNCTION trigger_log_invoice_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(
            NEW.organization_id,
            auth.uid(),
            'create',
            'invoice',
            NEW.id,
            NEW.invoice_number,
            'Creó la factura ' || NEW.invoice_number,
            NULL,
            jsonb_build_object('total', NEW.total, 'status', NEW.status)
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM log_activity(
                NEW.organization_id,
                auth.uid(),
                'update',
                'invoice',
                NEW.id,
                NEW.invoice_number,
                'Cambió estado de factura ' || NEW.invoice_number || ' a ' || NEW.status,
                jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status)),
                NULL
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_activity(
            OLD.organization_id,
            auth.uid(),
            'delete',
            'invoice',
            OLD.id,
            OLD.invoice_number,
            'Eliminó la factura ' || OLD.invoice_number,
            NULL,
            NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_invoice_activity ON invoices;
CREATE TRIGGER trigger_invoice_activity
    AFTER INSERT OR UPDATE OR DELETE ON invoices
    FOR EACH ROW EXECUTE FUNCTION trigger_log_invoice_changes();

-- Trigger para tasks
CREATE OR REPLACE FUNCTION trigger_log_task_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(
            NEW.organization_id,
            auth.uid(),
            'create',
            'task',
            NEW.id,
            NEW.title,
            'Creó la tarea ' || NEW.title,
            NULL,
            jsonb_build_object('priority', NEW.priority, 'due_date', NEW.due_date)
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            PERFORM log_activity(
                NEW.organization_id,
                auth.uid(),
                'update',
                'task',
                NEW.id,
                NEW.title,
                CASE WHEN NEW.status = 'completed' 
                    THEN 'Completó la tarea ' || NEW.title
                    ELSE 'Cambió estado de tarea ' || NEW.title || ' a ' || NEW.status
                END,
                jsonb_build_object('status', jsonb_build_object('old', OLD.status, 'new', NEW.status)),
                NULL
            );
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM log_activity(
            OLD.organization_id,
            auth.uid(),
            'delete',
            'task',
            OLD.id,
            OLD.title,
            'Eliminó la tarea ' || OLD.title,
            NULL,
            NULL
        );
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_task_activity ON tasks;
CREATE TRIGGER trigger_task_activity
    AFTER INSERT OR UPDATE OR DELETE ON tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_log_task_changes();

-- ============================================
-- Comentarios
-- ============================================
COMMENT ON TABLE activity_logs IS 'Registro de todas las actividades del CRM para auditoría y timeline';
COMMENT ON COLUMN activity_logs.action IS 'Tipo de acción: create, update, delete, view, login, export, import';
COMMENT ON COLUMN activity_logs.entity_type IS 'Tipo de entidad: contact, account, opportunity, invoice, task, ticket';
COMMENT ON COLUMN activity_logs.changes IS 'JSON con los cambios: { campo: { old: valor_anterior, new: valor_nuevo } }';
