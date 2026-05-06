-- Security definer RPC hardening, second pass
-- - Locks search_path for exposed RPCs
-- - Adds auth/tenant checks to SECURITY DEFINER functions that accept tenant/user IDs
-- - Restricts maintenance/admin/webhook functions to service_role

-- =====================================================
-- Core tenant helpers
-- =====================================================

CREATE OR REPLACE FUNCTION is_org_member(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF auth.role() <> 'service_role' THEN
        IF v_user_id IS NULL OR COALESCE(p_user_id, v_user_id) <> v_user_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM organization_members
        WHERE organization_id = p_org_id
          AND user_id = COALESCE(p_user_id, v_user_id)
          AND is_active = TRUE
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_org_role(p_org_id UUID, p_user_id UUID DEFAULT auth.uid())
RETURNS org_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role org_role;
    v_user_id UUID := auth.uid();
BEGIN
    IF p_org_id IS NULL THEN
        RETURN NULL;
    END IF;

    IF auth.role() <> 'service_role' THEN
        IF v_user_id IS NULL OR COALESCE(p_user_id, v_user_id) <> v_user_id THEN
            RETURN NULL;
        END IF;
    END IF;

    SELECT role INTO v_role
    FROM organization_members
    WHERE organization_id = p_org_id
      AND user_id = COALESCE(p_user_id, v_user_id)
      AND is_active = TRUE;

    RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION has_org_permission(p_org_id UUID, p_permission TEXT, p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_role org_role;
    v_action TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    IF p_org_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF auth.role() <> 'service_role' THEN
        IF v_user_id IS NULL OR COALESCE(p_user_id, v_user_id) <> v_user_id THEN
            RETURN FALSE;
        END IF;
    END IF;

    SELECT role INTO v_role
    FROM organization_members
    WHERE organization_id = p_org_id
      AND user_id = COALESCE(p_user_id, v_user_id)
      AND is_active = TRUE;

    IF v_role IS NULL THEN
        RETURN FALSE;
    END IF;

    v_action := split_part(COALESCE(p_permission, ''), '.', 2);

    CASE v_role
        WHEN 'owner', 'admin' THEN RETURN TRUE;
        WHEN 'manager', 'member' THEN RETURN v_action IN ('read', 'write', 'create', 'update');
        WHEN 'viewer' THEN RETURN v_action = 'read';
        ELSE RETURN FALSE;
    END CASE;
END;
$$;

ALTER FUNCTION get_current_organization_id()
    SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION get_current_organization_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION is_org_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_org_role(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION has_org_permission(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_current_organization_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_org_member(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_org_role(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION has_org_permission(UUID, TEXT, UUID) TO authenticated, service_role;

-- =====================================================
-- Search and duplicate-contact RPCs
-- =====================================================

CREATE OR REPLACE FUNCTION search_contacts(
    p_org_id UUID,
    p_query TEXT,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    similarity_score REAL
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
BEGIN
    IF p_org_id IS NULL OR p_query IS NULL OR btrim(p_query) = '' THEN
        RETURN;
    END IF;

    IF v_user_id IS NULL OR NOT is_org_member(p_org_id, v_user_id) THEN
        RAISE EXCEPTION 'Not authorized for organization %', p_org_id USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.company,
        GREATEST(
            similarity(lower(c.name), lower(p_query)),
            similarity(lower(COALESCE(c.email, '')), lower(p_query)),
            similarity(COALESCE(c.phone, ''), p_query)
        ) AS similarity_score
    FROM contacts c
    WHERE c.organization_id = p_org_id
      AND (
          lower(c.name) ILIKE '%' || lower(p_query) || '%'
          OR lower(COALESCE(c.email, '')) ILIKE '%' || lower(p_query) || '%'
          OR c.phone ILIKE '%' || p_query || '%'
      )
    ORDER BY similarity_score DESC
    LIMIT v_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF p_organization_id IS NULL THEN
        RETURN;
    END IF;

    IF v_user_id IS NULL OR NOT is_org_member(p_organization_id, v_user_id) THEN
        RAISE EXCEPTION 'Not authorized for organization %', p_organization_id USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT DISTINCT
        c.id,
        c.name,
        c.email,
        c.phone,
        CASE
            WHEN c.email = p_email AND p_email IS NOT NULL THEN 'email'::VARCHAR
            WHEN c.phone = p_phone AND p_phone IS NOT NULL THEN 'phone'::VARCHAR
            WHEN LOWER(c.name) = LOWER(p_name) AND p_name IS NOT NULL THEN 'name'::VARCHAR
        END AS match_type
    FROM contacts c
    WHERE c.organization_id = p_organization_id
      AND (p_exclude_id IS NULL OR c.id <> p_exclude_id)
      AND (
          (p_email IS NOT NULL AND c.email = p_email)
          OR (p_phone IS NOT NULL AND c.phone = p_phone)
          OR (p_name IS NOT NULL AND LOWER(c.name) = LOWER(p_name))
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION search_contacts(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION find_duplicate_contacts(UUID, VARCHAR, VARCHAR, VARCHAR, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION search_contacts(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_contacts(UUID, VARCHAR, VARCHAR, VARCHAR, UUID) TO authenticated;

-- =====================================================
-- AI conversation RPCs
-- =====================================================

CREATE OR REPLACE FUNCTION get_or_create_conversation(p_org_id UUID, p_user_id UUID, p_title TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    IF p_org_id IS NULL OR p_user_id IS NULL THEN
        RAISE EXCEPTION 'organization_id and user_id are required';
    END IF;

    IF v_user_id IS NULL OR p_user_id <> v_user_id THEN
        RAISE EXCEPTION 'Not authorized to create conversation for another user' USING ERRCODE = '42501';
    END IF;

    IF NOT is_org_member(p_org_id, v_user_id) THEN
        RAISE EXCEPTION 'Not authorized for organization %', p_org_id USING ERRCODE = '42501';
    END IF;

    SELECT id INTO v_conversation_id
    FROM ai_conversations
    WHERE organization_id = p_org_id
      AND user_id = v_user_id
      AND updated_at > NOW() - INTERVAL '1 hour'
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_conversation_id IS NULL THEN
        INSERT INTO ai_conversations (organization_id, user_id, title)
        VALUES (p_org_id, v_user_id, COALESCE(NULLIF(left(p_title, 120), ''), 'Nueva conversacion'))
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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
    v_user_id UUID := auth.uid();
    v_conversation ai_conversations%ROWTYPE;
BEGIN
    IF p_conversation_id IS NULL OR p_role IS NULL OR p_content IS NULL THEN
        RAISE EXCEPTION 'conversation_id, role, and content are required';
    END IF;

    IF p_role NOT IN ('user', 'assistant', 'system') THEN
        RAISE EXCEPTION 'Invalid message role';
    END IF;

    IF length(p_content) > 50000 THEN
        RAISE EXCEPTION 'Message content is too long';
    END IF;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_conversation
    FROM ai_conversations
    WHERE id = p_conversation_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conversation not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_conversation.user_id <> v_user_id OR NOT is_org_member(v_conversation.organization_id, v_user_id) THEN
        RAISE EXCEPTION 'Not authorized for conversation' USING ERRCODE = '42501';
    END IF;

    INSERT INTO ai_messages (conversation_id, role, content, metadata, tokens_used, model)
    VALUES (p_conversation_id, p_role, p_content, COALESCE(p_metadata, '{}'::jsonb), p_tokens_used, p_model)
    RETURNING id INTO v_message_id;

    UPDATE ai_conversations
    SET updated_at = NOW(),
        title = CASE
            WHEN title IS NULL OR title = 'Nueva conversacion' OR title = 'Nueva conversación'
                THEN left(p_content, 50) || '...'
            ELSE title
        END
    WHERE id = p_conversation_id
      AND user_id = v_user_id;

    RETURN v_message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION add_ai_message(UUID, TEXT, TEXT, JSONB, INTEGER, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION get_or_create_conversation(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION add_ai_message(UUID, TEXT, TEXT, JSONB, INTEGER, TEXT) TO authenticated;

-- =====================================================
-- Subscription and plan RPCs
-- =====================================================

CREATE OR REPLACE FUNCTION check_subscription_status(p_organization_id UUID)
RETURNS TABLE (
    is_active BOOLEAN,
    status subscription_status,
    days_remaining INTEGER,
    plan subscription_plan
) AS $$
DECLARE
    v_org organizations%ROWTYPE;
    v_user_id UUID := auth.uid();
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF v_user_id IS NULL OR NOT is_org_member(p_organization_id, v_user_id) THEN
        RAISE EXCEPTION 'Not authorized for organization %', p_organization_id USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_org FROM organizations WHERE id = p_organization_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'expired'::subscription_status, 0, 'trial'::subscription_plan;
        RETURN;
    END IF;

    IF v_org.subscription_status = 'trial' THEN
        IF v_org.trial_ends_at IS NULL OR v_org.trial_ends_at > NOW() THEN
            RETURN QUERY SELECT
                true,
                'trial'::subscription_status,
                COALESCE(EXTRACT(DAY FROM (v_org.trial_ends_at - NOW()))::INTEGER, 2),
                'trial'::subscription_plan;
        ELSE
            UPDATE organizations
            SET subscription_status = 'expired'
            WHERE id = p_organization_id;

            RETURN QUERY SELECT false, 'expired'::subscription_status, 0, 'trial'::subscription_plan;
        END IF;
        RETURN;
    END IF;

    IF v_org.subscription_status = 'active' THEN
        IF v_org.subscription_ends_at IS NULL OR v_org.subscription_ends_at > NOW() THEN
            RETURN QUERY SELECT
                true,
                'active'::subscription_status,
                COALESCE(EXTRACT(DAY FROM (v_org.subscription_ends_at - NOW()))::INTEGER, 30),
                v_org.subscription_plan;
        ELSE
            UPDATE organizations
            SET subscription_status = 'expired'
            WHERE id = p_organization_id;

            RETURN QUERY SELECT false, 'expired'::subscription_status, 0, v_org.subscription_plan;
        END IF;
        RETURN;
    END IF;

    RETURN QUERY SELECT false, v_org.subscription_status, 0, v_org.subscription_plan;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION check_plan_limits(
    p_organization_id UUID,
    p_resource TEXT,
    p_current_count INTEGER DEFAULT NULL
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INTEGER,
    max_allowed INTEGER,
    plan_name TEXT
) AS $$
DECLARE
    v_org organizations%ROWTYPE;
    v_plan subscription_plans%ROWTYPE;
    v_count INTEGER;
    v_max INTEGER;
    v_user_id UUID := auth.uid();
BEGIN
    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF p_resource NOT IN ('users', 'contacts', 'invoices') THEN
        RAISE EXCEPTION 'Unsupported resource limit: %', p_resource;
    END IF;

    IF auth.role() <> 'service_role' THEN
        IF v_user_id IS NULL OR NOT is_org_member(p_organization_id, v_user_id) THEN
            RAISE EXCEPTION 'Not authorized for organization %', p_organization_id USING ERRCODE = '42501';
        END IF;
    END IF;

    SELECT * INTO v_org FROM organizations WHERE id = p_organization_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found' USING ERRCODE = 'P0002';
    END IF;

    SELECT * INTO v_plan FROM subscription_plans WHERE name = v_org.subscription_plan::TEXT;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription plan not found';
    END IF;

    IF p_current_count IS NULL THEN
        CASE p_resource
            WHEN 'users' THEN
                SELECT COUNT(*) INTO v_count
                FROM organization_members
                WHERE organization_id = p_organization_id
                  AND is_active = TRUE;
            WHEN 'contacts' THEN
                SELECT COUNT(*) INTO v_count
                FROM contacts
                WHERE organization_id = p_organization_id;
            WHEN 'invoices' THEN
                SELECT COUNT(*) INTO v_count
                FROM invoices
                WHERE organization_id = p_organization_id
                  AND created_at >= date_trunc('month', NOW());
        END CASE;
    ELSE
        v_count := GREATEST(p_current_count, 0);
    END IF;

    CASE p_resource
        WHEN 'users' THEN v_max := COALESCE(v_org.max_users, v_plan.max_users, 3);
        WHEN 'contacts' THEN v_max := COALESCE(v_org.max_contacts, v_plan.max_contacts, 500);
        WHEN 'invoices' THEN v_max := COALESCE(v_plan.max_invoices_month, 100);
    END CASE;

    RETURN QUERY SELECT (v_max = -1 OR v_count < v_max), v_count, v_max, v_plan.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION check_subscription_status(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION check_plan_limits(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION check_subscription_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_plan_limits(UUID, TEXT, INTEGER) TO authenticated, service_role;

-- Admin/subscription mutators are server-only.
ALTER FUNCTION create_organization_with_trial(TEXT, TEXT, TEXT, TEXT, UUID, INTEGER)
    SET search_path = public, pg_temp;
ALTER FUNCTION activate_subscription(UUID, subscription_plan, TEXT, TEXT, UUID)
    SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION create_organization_with_trial(TEXT, TEXT, TEXT, TEXT, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION activate_subscription(UUID, subscription_plan, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION create_organization_with_trial(TEXT, TEXT, TEXT, TEXT, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION activate_subscription(UUID, subscription_plan, TEXT, TEXT, UUID) TO service_role;

-- =====================================================
-- Workflow log RPCs
-- =====================================================

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

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

    IF p_status NOT IN ('pending', 'running', 'success', 'failed', 'skipped') THEN
        RAISE EXCEPTION 'Invalid workflow action status: %', p_status;
    END IF;

    SELECT started_at INTO v_started_at
    FROM workflow_action_logs
    WHERE id = p_log_id;

    UPDATE workflow_action_logs
    SET status = p_status,
        completed_at = NOW(),
        duration_ms = CASE
            WHEN v_started_at IS NULL THEN NULL
            ELSE (EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000)::INTEGER
        END,
        output_result = p_output_result,
        error_message = p_error_message
    WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP FUNCTION IF EXISTS get_workflow_execution_logs(UUID);
CREATE FUNCTION get_workflow_execution_logs(p_execution_id UUID)
RETURNS TABLE (
    id UUID,
    action_type TEXT,
    status TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    error_message TEXT,
    result JSONB
) AS $$
DECLARE
    v_org_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    SELECT organization_id INTO v_org_id
    FROM workflow_executions
    WHERE workflow_executions.id = p_execution_id;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Workflow execution not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_user_id IS NULL OR NOT is_org_member(v_org_id, v_user_id) THEN
        RAISE EXCEPTION 'Not authorized for workflow execution' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        wal.id,
        wal.action_type,
        wal.status,
        wal.started_at,
        wal.completed_at,
        wal.duration_ms,
        wal.error_message,
        wal.output_result AS result
    FROM workflow_action_logs wal
    WHERE wal.execution_id = p_execution_id
      AND wal.organization_id = v_org_id
    ORDER BY wal.started_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION log_workflow_action_start(UUID, UUID, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_workflow_action_complete(UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION get_workflow_execution_logs(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION log_workflow_action_start(UUID, UUID, TEXT, INTEGER, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION log_workflow_action_complete(UUID, TEXT, JSONB, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_workflow_execution_logs(UUID) TO authenticated;

-- =====================================================
-- Maintenance, public-form and webhook functions
-- =====================================================

ALTER FUNCTION cleanup_auditoria(INTEGER)
    SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_analytics_cache_ttl(INTEGER)
    SET search_path = public, pg_temp;
ALTER FUNCTION cleanup_analytics_cache()
    SET search_path = public, pg_temp;
ALTER FUNCTION expire_old_quotes()
    SET search_path = public, pg_temp;
ALTER FUNCTION expire_overdue_quotes()
    SET search_path = public, pg_temp;
DO $$
BEGIN
  IF to_regprocedure('cleanup_old_idempotency_keys()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION cleanup_old_idempotency_keys() SET search_path = public, pg_temp';
  END IF;
END;
$$;
ALTER FUNCTION process_form_submission(UUID, JSONB, INET, TEXT, TEXT, VARCHAR, VARCHAR, VARCHAR)
    SET search_path = public, pg_temp;
ALTER FUNCTION increment_form_views(UUID)
    SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION cleanup_auditoria(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_analytics_cache_ttl(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION cleanup_analytics_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION expire_old_quotes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION expire_overdue_quotes() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF to_regprocedure('cleanup_old_idempotency_keys()') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION cleanup_old_idempotency_keys() FROM PUBLIC, anon, authenticated';
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION process_form_submission(UUID, JSONB, INET, TEXT, TEXT, VARCHAR, VARCHAR, VARCHAR) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_form_views(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_auditoria(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_analytics_cache_ttl(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_analytics_cache() TO service_role;
GRANT EXECUTE ON FUNCTION expire_old_quotes() TO service_role;
GRANT EXECUTE ON FUNCTION expire_overdue_quotes() TO service_role;
DO $$
BEGIN
  IF to_regprocedure('cleanup_old_idempotency_keys()') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION cleanup_old_idempotency_keys() TO service_role';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION process_form_submission(UUID, JSONB, INET, TEXT, TEXT, VARCHAR, VARCHAR, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION increment_form_views(UUID) TO service_role;

ALTER FUNCTION process_stripe_checkout_completed(TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, TIMESTAMPTZ)
    SET search_path = public, pg_temp;
ALTER FUNCTION process_stripe_invoice_paid(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ)
    SET search_path = public, pg_temp;
ALTER FUNCTION process_stripe_payment_failed(TEXT)
    SET search_path = public, pg_temp;
ALTER FUNCTION process_stripe_subscription_cancelled(TEXT)
    SET search_path = public, pg_temp;
ALTER FUNCTION notify_trial_expiring()
    SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION process_stripe_checkout_completed(TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION process_stripe_invoice_paid(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION process_stripe_payment_failed(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION process_stripe_subscription_cancelled(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION notify_trial_expiring() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION process_stripe_checkout_completed(TEXT, TEXT, UUID, TEXT, TEXT, INTEGER, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION process_stripe_invoice_paid(TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION process_stripe_payment_failed(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION process_stripe_subscription_cancelled(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION notify_trial_expiring() TO service_role;

-- Trigger/internal functions should not be direct RPC surface.
ALTER FUNCTION update_contact_last_interaction()
    SET search_path = public, pg_temp;
ALTER FUNCTION handle_new_user()
    SET search_path = public, pg_temp;
ALTER FUNCTION update_analytics_cache()
    SET search_path = public, pg_temp;
ALTER FUNCTION log_activity(UUID, UUID, VARCHAR, VARCHAR, UUID, VARCHAR, TEXT, JSONB, JSONB)
    SET search_path = public, pg_temp;
ALTER FUNCTION trigger_log_contact_changes()
    SET search_path = public, pg_temp;
ALTER FUNCTION trigger_log_opportunity_changes()
    SET search_path = public, pg_temp;
ALTER FUNCTION trigger_log_invoice_changes()
    SET search_path = public, pg_temp;
ALTER FUNCTION trigger_log_task_changes()
    SET search_path = public, pg_temp;
ALTER FUNCTION set_tenant_defaults_org_created_by()
    SET search_path = public, pg_temp;
ALTER FUNCTION set_tenant_defaults_org_only()
    SET search_path = public, pg_temp;
ALTER FUNCTION handle_new_organization()
    SET search_path = public, pg_temp;
ALTER FUNCTION set_quote_number()
    SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION update_contact_last_interaction() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_analytics_cache() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION log_activity(UUID, UUID, VARCHAR, VARCHAR, UUID, VARCHAR, TEXT, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_log_contact_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_log_opportunity_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_log_invoice_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION trigger_log_task_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_tenant_defaults_org_created_by() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_tenant_defaults_org_only() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_organization() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION set_quote_number() FROM PUBLIC, anon, authenticated;

-- Invitation accept remains authenticated, but lock its search_path.
ALTER FUNCTION accept_organization_invitation(TEXT)
    SET search_path = public, pg_temp;
REVOKE EXECUTE ON FUNCTION accept_organization_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION accept_organization_invitation(TEXT) TO authenticated;

-- Private encryption key helpers stay private.
ALTER FUNCTION private.get_app_encryption_key()
    SET search_path = private, public, pg_temp;
ALTER FUNCTION private.set_app_encryption_key(TEXT)
    SET search_path = private, public, pg_temp;
REVOKE ALL ON FUNCTION private.get_app_encryption_key() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.set_app_encryption_key(TEXT) FROM PUBLIC, anon, authenticated;
