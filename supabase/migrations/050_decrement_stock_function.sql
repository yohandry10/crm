-- Function to decrement stock safely (prevents negative stock)
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE products
    SET stock_quantity = GREATEST(0, stock_quantity - p_quantity),
        updated_at = NOW()
    WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION decrement_stock(UUID, INTEGER) TO authenticated;
