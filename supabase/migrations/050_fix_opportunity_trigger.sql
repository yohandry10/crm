-- ============================================
-- MIGRACIÓN: Fix trigger_log_opportunity_changes
-- ============================================
-- Corrige la referencia a 'amount' que no existe en opportunities
-- El campo correcto es 'expected_revenue'

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
            jsonb_build_object('expected_revenue', NEW.expected_revenue, 'stage_id', NEW.stage_id)
        );
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        v_action := 'update';
        v_changes := '{}'::jsonb;
        
        IF OLD.name IS DISTINCT FROM NEW.name THEN
            v_changes := v_changes || jsonb_build_object('name', jsonb_build_object('old', OLD.name, 'new', NEW.name));
        END IF;
        IF OLD.expected_revenue IS DISTINCT FROM NEW.expected_revenue THEN
            v_changes := v_changes || jsonb_build_object('expected_revenue', jsonb_build_object('old', OLD.expected_revenue, 'new', NEW.expected_revenue));
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
