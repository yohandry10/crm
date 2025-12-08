-- =====================================================
-- CASE-INSENSITIVE SEARCH (MULTI-TENANT)
-- =====================================================

-- Extensiones
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Función helper para búsqueda sin acentos
CREATE OR REPLACE FUNCTION unaccent_lower(p_text text)
RETURNS text AS $$
  SELECT lower(unaccent(COALESCE(p_text, '')));
$$ LANGUAGE SQL IMMUTABLE STRICT;

-- Índices GIN para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin(name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_email_trgm ON contacts USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_phone_trgm ON contacts USING gin(phone gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number_trgm ON invoices USING gin(invoice_number gin_trgm_ops);

-- Función de búsqueda de contactos (MULTI-TENANT)
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
BEGIN
    IF p_org_id IS NULL OR p_query IS NULL OR p_query = '' THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        c.id, c.name, c.email, c.phone, c.company,
        GREATEST(
            similarity(lower(c.name), lower(p_query)),
            similarity(lower(COALESCE(c.email, '')), lower(p_query)),
            similarity(COALESCE(c.phone, ''), p_query)
        ) as similarity_score
    FROM contacts c
    WHERE c.organization_id = p_org_id
      AND (
          lower(c.name) ILIKE '%' || lower(p_query) || '%'
          OR lower(COALESCE(c.email, '')) ILIKE '%' || lower(p_query) || '%'
          OR c.phone ILIKE '%' || p_query || '%'
      )
    ORDER BY similarity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
