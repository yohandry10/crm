-- =====================================================
-- RLS POLICIES ADICIONALES (si no existen)
-- =====================================================
-- Las políticas principales están en 003_rls_policies.sql
-- Este archivo solo agrega políticas faltantes

-- System health (no es multi-tenant, es global)
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service can insert health checks" ON system_health
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view system health" ON system_health
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );
