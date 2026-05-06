-- Align revenue/inventory contracts across invoices, quotes and sales orders.
-- This migration keeps product references tenant-scoped before stock changes.

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE SET NULL;

ALTER TABLE invoice_items
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(8,4) DEFAULT 0.18;

CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON invoice_items(product_id);

CREATE SEQUENCE IF NOT EXISTS sales_order_number_seq START 1;

ALTER TYPE sales_order_status ADD VALUE IF NOT EXISTS 'completed';

ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS order_number TEXT;

ALTER TABLE sales_orders
    ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

UPDATE sales_orders
SET order_number = 'SO-' || TO_CHAR(COALESCE(created_at, NOW()), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('sales_order_number_seq')::TEXT, 5, '0')
WHERE order_number IS NULL;

UPDATE sales_orders
SET items = '[]'::jsonb
WHERE items IS NULL;

ALTER TABLE sales_orders
    ALTER COLUMN order_number SET DEFAULT ('SO-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('sales_order_number_seq')::TEXT, 5, '0')),
    ALTER COLUMN order_number SET NOT NULL,
    ALTER COLUMN items SET DEFAULT '[]'::jsonb,
    ALTER COLUMN items SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_orders_org_order_number ON sales_orders(organization_id, order_number);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'sales_orders_items_array_check'
    ) THEN
        ALTER TABLE sales_orders
            ADD CONSTRAINT sales_orders_items_array_check
            CHECK (jsonb_typeof(items) = 'array') NOT VALID;
    END IF;
END $$;

ALTER TABLE sales_orders VALIDATE CONSTRAINT sales_orders_items_array_check;

CREATE OR REPLACE FUNCTION create_invoice_with_items_atomic(
    p_org_id UUID,
    p_user_id UUID,
    p_contact_id UUID,
    p_items JSONB,
    p_due_date DATE DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    invoice_id UUID,
    invoice_number TEXT,
    total_amount NUMERIC,
    items_created INTEGER
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_invoice_id UUID;
    v_invoice_number TEXT;
    v_subtotal NUMERIC := 0;
    v_tax NUMERIC := 0;
    v_total NUMERIC := 0;
    v_item JSONB;
    v_items_count INTEGER := 0;
    v_product RECORD;
    v_description TEXT;
    v_item_price NUMERIC;
    v_item_quantity NUMERIC;
    v_item_subtotal NUMERIC;
    v_item_tax_rate NUMERIC;
    v_product_id UUID;
    v_product_id_text TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF p_user_id IS NULL OR p_user_id <> v_user_id THEN
        RAISE EXCEPTION 'User mismatch for invoice creation' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM organization_members om
        WHERE om.organization_id = p_org_id
          AND om.user_id = v_user_id
          AND om.is_active = TRUE
    ) THEN
        RAISE EXCEPTION 'Not authorized for organization %', p_org_id USING ERRCODE = '42501';
    END IF;

    IF p_contact_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM contacts c
        WHERE c.id = p_contact_id
          AND c.organization_id = p_org_id
    ) THEN
        RAISE EXCEPTION 'Contact not found for organization' USING ERRCODE = '42501';
    END IF;

    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Se requiere al menos un item';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_description := NULLIF(BTRIM(COALESCE(v_item->>'description', '')), '');
        v_item_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1);
        v_item_price := COALESCE(NULLIF(v_item->>'unit_price', '')::NUMERIC, NULLIF(v_item->>'price', '')::NUMERIC, 0);
        v_item_tax_rate := COALESCE(NULLIF(v_item->>'tax_rate', '')::NUMERIC, 0.18);

        IF v_item_tax_rate > 1 THEN
            v_item_tax_rate := v_item_tax_rate / 100;
        END IF;

        IF v_description IS NULL THEN
            RAISE EXCEPTION 'Item description is required';
        END IF;

        IF v_item_quantity <= 0 THEN
            RAISE EXCEPTION 'Item quantity must be positive';
        END IF;

        IF v_item_price < 0 OR v_item_tax_rate < 0 THEN
            RAISE EXCEPTION 'Item price and tax rate must be non-negative';
        END IF;

        v_item_subtotal := v_item_quantity * v_item_price;
        v_subtotal := v_subtotal + v_item_subtotal;
        v_tax := v_tax + (v_item_subtotal * v_item_tax_rate);
    END LOOP;

    v_total := v_subtotal + v_tax;

    SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0')
    INTO v_invoice_number;

    INSERT INTO invoices (organization_id, created_by, contact_id, invoice_number, status, issue_date, due_date, subtotal, tax, total, notes)
    VALUES (p_org_id, p_user_id, p_contact_id, v_invoice_number, 'draft', CURRENT_DATE, COALESCE(p_due_date, CURRENT_DATE + INTERVAL '30 days'), v_subtotal, v_tax, v_total, p_notes)
    RETURNING id INTO v_invoice_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_description := NULLIF(BTRIM(COALESCE(v_item->>'description', '')), '');
        v_item_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::NUMERIC, 1);
        v_item_price := COALESCE(NULLIF(v_item->>'unit_price', '')::NUMERIC, NULLIF(v_item->>'price', '')::NUMERIC, 0);
        v_item_tax_rate := COALESCE(NULLIF(v_item->>'tax_rate', '')::NUMERIC, 0.18);
        v_product_id_text := COALESCE(NULLIF(v_item->>'product_id', ''), NULLIF(v_item->>'inventory_id', ''));
        v_product_id := NULL;

        IF v_item_tax_rate > 1 THEN
            v_item_tax_rate := v_item_tax_rate / 100;
        END IF;

        IF v_product_id_text IS NOT NULL THEN
            v_product_id := v_product_id_text::UUID;

            SELECT id, organization_id, name, stock_quantity, is_service
            INTO v_product
            FROM products
            WHERE id = v_product_id
              AND organization_id = p_org_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Producto % no encontrado para la organizacion', v_product_id USING ERRCODE = '42501';
            END IF;
        END IF;

        v_item_subtotal := v_item_quantity * v_item_price;

        INSERT INTO invoice_items (invoice_id, product_id, description, quantity, unit_price, tax_rate, total)
        VALUES (v_invoice_id, v_product_id, v_description, v_item_quantity, v_item_price, v_item_tax_rate, v_item_subtotal);

        v_items_count := v_items_count + 1;

        IF v_product_id IS NOT NULL AND COALESCE(v_product.is_service, FALSE) = FALSE THEN
            IF COALESCE(v_product.stock_quantity, 0) < v_item_quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para %', v_product.name;
            END IF;

            UPDATE products
            SET stock_quantity = stock_quantity - v_item_quantity,
                updated_at = NOW()
            WHERE id = v_product.id;

            INSERT INTO inventory_movements (
                organization_id,
                product_id,
                created_by,
                type,
                quantity,
                previous_quantity,
                new_quantity,
                reason,
                reference_type,
                reference_id
            )
            VALUES (
                p_org_id,
                v_product.id,
                p_user_id,
                'out',
                v_item_quantity,
                v_product.stock_quantity,
                v_product.stock_quantity - v_item_quantity,
                'Venta - Factura',
                'invoice',
                v_invoice_id
            );
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_invoice_id, v_invoice_number, v_total, v_items_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE EXECUTE ON FUNCTION create_invoice_with_items_atomic(UUID, UUID, UUID, JSONB, DATE, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION create_invoice_with_items_atomic(UUID, UUID, UUID, JSONB, DATE, TEXT) TO authenticated;
