-- Migration: 048_cleanup_functions.sql
-- Description: Add cleanup functions for cron jobs
-- Date: 2025-12-06

-- Function to cleanup old audit logs
CREATE OR REPLACE FUNCTION cleanup_auditoria(p_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs
    WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup analytics cache with TTL
CREATE OR REPLACE FUNCTION cleanup_analytics_cache_ttl(p_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Check if table exists before deleting
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'analytics_cache') THEN
        DELETE FROM analytics_cache
        WHERE created_at < NOW() - (p_days || ' days')::INTERVAL;
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
    ELSE
        deleted_count := 0;
    END IF;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup analytics cache (alias)
CREATE OR REPLACE FUNCTION cleanup_analytics_cache()
RETURNS INTEGER AS $$
BEGIN
    RETURN cleanup_analytics_cache_ttl(30);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire old quotes
CREATE OR REPLACE FUNCTION expire_old_quotes()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE quotes
    SET status = 'expired'
    WHERE status = 'draft'
    AND valid_until IS NOT NULL
    AND valid_until < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get workflow execution logs
CREATE OR REPLACE FUNCTION get_workflow_execution_logs(p_execution_id UUID)
RETURNS TABLE (
    id UUID,
    action_type TEXT,
    status TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    result JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wal.id,
        wal.action_type,
        wal.status,
        wal.started_at,
        wal.completed_at,
        wal.error_message,
        wal.result
    FROM workflow_action_logs wal
    WHERE wal.execution_id = p_execution_id
    ORDER BY wal.started_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION cleanup_auditoria(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_analytics_cache_ttl(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_analytics_cache() TO service_role;
GRANT EXECUTE ON FUNCTION expire_old_quotes() TO service_role;
GRANT EXECUTE ON FUNCTION get_workflow_execution_logs(UUID) TO authenticated;

COMMENT ON FUNCTION cleanup_auditoria IS 'Removes audit logs older than specified days';
COMMENT ON FUNCTION cleanup_analytics_cache_ttl IS 'Removes analytics cache entries older than specified days';
COMMENT ON FUNCTION expire_old_quotes IS 'Marks quotes as expired if past valid_until date';
COMMENT ON FUNCTION get_workflow_execution_logs IS 'Returns detailed logs for a workflow execution';
