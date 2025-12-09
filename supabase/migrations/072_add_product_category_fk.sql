-- Add foreign key constraint to products.category_id
-- This allows PostgREST to detect the relationship between products and product_categories

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_products_categories'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT fk_products_categories
        FOREIGN KEY (category_id)
        REFERENCES product_categories(id)
        ON DELETE SET NULL;
    END IF;
END $$;
