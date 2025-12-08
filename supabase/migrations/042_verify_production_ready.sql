-- =====================================================
-- VERIFY PRODUCTION READY - MULTI-TENANT
-- =====================================================

DO $$
DECLARE
    v_tables_with_org INTEGER;
    v_tables_with_rls INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_tables_with_org
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'organization_id';
    
    SELECT COUNT(*) INTO v_tables_with_rls
    FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
    
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'MULTI-TENANT VERIFICATION';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Tables with organization_id: %', v_tables_with_org;
    RAISE NOTICE 'Tables with RLS enabled: %', v_tables_with_rls;
    RAISE NOTICE '=====================================================';
END $$;
