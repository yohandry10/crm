-- =====================================================
-- MIGRATION: Drop duplicate indexes (BAJO-001)
-- Purpose: Remove strictly duplicated (same columns/predicate/method/opclass) indexes.
-- Note: Supabase SQL editor runs in a transaction, so avoid CONCURRENTLY here.
-- Safe: Idempotent via IF EXISTS.
-- =====================================================

-- auditoria: idx_auditoria_org_fecha vs idx_auditoria_org_time (keep *_org_fecha)
DROP INDEX IF EXISTS public.idx_auditoria_org_time;

-- chat_messages: idx_chat_messages_org_date vs idx_chat_org_created (keep idx_chat_messages_org_date)
DROP INDEX IF EXISTS public.idx_chat_org_created;

-- contacts: idx_contacts_lead_score vs idx_contacts_org_score (keep idx_contacts_lead_score)
DROP INDEX IF EXISTS public.idx_contacts_org_score;

-- workflow_executions: idx_workflow_executions_org vs idx_workflow_exec_org (keep idx_workflow_executions_org)
DROP INDEX IF EXISTS public.idx_workflow_exec_org;

