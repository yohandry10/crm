-- Centralized audit trail metadata for support/debugging.
-- Keeps using public.auditoria so existing RLS/cleanup flows continue to work.

ALTER TABLE public.auditoria
  ADD COLUMN IF NOT EXISTS event_category TEXT,
  ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS request_id TEXT;

ALTER TABLE public.auditoria
  DROP CONSTRAINT IF EXISTS auditoria_event_category_check,
  ADD CONSTRAINT auditoria_event_category_check
    CHECK (event_category IS NULL OR event_category IN ('auth', 'billing', 'data', 'admin', 'export', 'security', 'system'));

ALTER TABLE public.auditoria
  DROP CONSTRAINT IF EXISTS auditoria_severity_check,
  ADD CONSTRAINT auditoria_severity_check
    CHECK (severity IN ('info', 'warn', 'error'));

CREATE INDEX IF NOT EXISTS idx_auditoria_user_time
  ON public.auditoria(usuario_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_category_time
  ON public.auditoria(event_category, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_success_time
  ON public.auditoria(success, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_request_id
  ON public.auditoria(request_id)
  WHERE request_id IS NOT NULL;

DROP POLICY IF EXISTS "Org members can view audit logs" ON public.auditoria;
DROP POLICY IF EXISTS "Tenant admins can view audit logs" ON public.auditoria;

CREATE POLICY "Tenant admins can view audit logs" ON public.auditoria
FOR SELECT
USING (
  (organization_id IS NULL AND auth.uid() = usuario_id)
  OR get_org_role(organization_id) IN ('owner', 'admin')
  OR EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_platform_admin = TRUE
  )
);
