-- Migration: 047_check_quote_stock.sql
-- Description: Add function to check stock availability for quotes
-- Date: 2025-12-06

-- Function to check if all products in a quote have sufficient stock
CREATE OR REPLACE FUNCTION check_quote_stock_availability(p_quote_id UUID)
RETURNS TABLE (
    product_id UUID,
    product_name TEXT,
    required_quantity NUMERIC,
    available_quantity NUMERIC,
    has_stock BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id AS product_id,
        p.name AS product_name,
        qi.quantity AS required_quantity,
        COALESCE(p.stock_quantity, 0)::NUMERIC AS available_quantity,
        COALESCE(p.stock_quantity, 0) >= qi.quantity AS has_stock
    FROM quote_items qi
    LEFT JOIN products p ON p.id = qi.product_id
    WHERE qi.quote_id = p_quote_id
    AND qi.product_id IS NOT NULL
    AND p.is_service = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION check_quote_stock_availability(UUID) TO authenticated;

COMMENT ON FUNCTION check_quote_stock_availability IS 'Checks if all products in a quote have sufficient stock available';
