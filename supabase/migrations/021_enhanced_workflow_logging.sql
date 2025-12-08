-- =====================================================
-- WORKFLOW ACTION LOGS (MULTI-TENANT)
-- =====================================================

CREATE TABLE IF NOT EXISTS workflow_action_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    action_index INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'success', 'failed', 'skipped')),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    input_params JSONB,
    output_result JSONB,
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_workflow_action_logs_org ON workflow_action_logs(organization_id);
CREATE INDEX idx_workflow_action_logs_execution ON workflow_action_logs(execution_id, action_index);
CREATE INDEX idx_workflow_action_logs_status ON workflow_action_logs(status, created_at DESC);

ALTER TABLE workflow_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view workflow logs" ON workflow_action_logs
    FOR SELECT USING (is_org_member(organization_id));

CREATE POLICY "Org members can insert workflow logs" ON workflow_action_logs
    FOR INSERT WITH CHECK (is_org_member(organization_id));

-- Log workflow action start
CREATE OR REPLACE FUNCTION log_workflow_action_start(
    p_org_id UUID,
    p_execution_id UUID,
    p_action_type TEXT,
    p_action_index INTEGER,
    p_input_params JSONB
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    INSERT INTO workflow_action_logs (organization_id, execution_id, action_type, action_index, status, input_params)
    VALUES (p_org_id, p_execution_id, p_action_type, p_action_index, 'running', p_input_params)
    RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log workflow action completion
CREATE OR REPLACE FUNCTION log_workflow_action_complete(
    p_log_id UUID,
    p_status TEXT,
    p_output_result JSONB DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_started_at TIMESTAMP WITH TIME ZONE;
BEGIN
    IF p_log_id IS NULL THEN
        RETURN;
    END IF;

    SELECT started_at INTO v_started_at FROM workflow_action_logs WHERE id = p_log_id;
    
    UPDATE workflow_action_logs
    SET status = p_status,
        completed_at = NOW(),
        duration_ms = EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000,
        output_result = p_output_result,
        error_message = p_error_message
    WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
