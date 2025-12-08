-- =====================================================
-- SCRIPT: Eliminar organization_settings
-- Ya no se usa - todo está en organizations
-- =====================================================

-- Eliminar la tabla (CASCADE elimina triggers y constraints)
DROP TABLE IF EXISTS organization_settings CASCADE;

-- Verificar que se eliminó
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'organization_settings';
-- Debe retornar 0 filas
