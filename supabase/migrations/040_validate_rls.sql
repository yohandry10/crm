-- =====================================================
-- VALIDACIÓN RLS MULTI-TENANT
-- =====================================================

SELECT 
    schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

SELECT 
    tablename, policyname,
    CASE WHEN qual LIKE '%organization_id%' OR qual LIKE '%is_org_member%' THEN '✓ Multi-tenant'
         ELSE '⚠ Revisar' END as tenant_filter
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
