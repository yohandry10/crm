-- =====================================================
-- CLEANUP OLD LOGS (MULTI-TENANT)
-- =====================================================

CREATE OR REPLACE FUNCTION cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    DELETE FROM webhook_events WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL AND processed = true;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    DELETE FROM workflow_action_logs WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    DELETE FROM system_health WHERE checked_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
