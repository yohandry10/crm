-- Unify inventory with products: use products.stock_quantity as canonical stock
-- - inventory_movements now references products (product_id)
-- - update analytics to count physical products (is_service = false)
-- - drop legacy inventory table (no production data)

-- 1) inventory_movements -> product_id
ALTER TABLE inventory_movements
    DROP CONSTRAINT IF EXISTS inventory_movements_inventory_id_fkey;

ALTER TABLE inventory_movements
    RENAME COLUMN inventory_id TO product_id;

ALTER TABLE inventory_movements
    ADD CONSTRAINT inventory_movements_product_fk
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- 2) Replace atomic invoice function to use products.stock_quantity
DROP FUNCTION IF EXISTS create_invoice_with_items_atomic(UUID, UUID, UUID, JSONB, DATE, TEXT);

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
    v_invoice_id UUID;
    v_invoice_number TEXT;
    v_subtotal NUMERIC := 0;
    v_tax NUMERIC := 0;
    v_total NUMERIC := 0;
    v_item JSONB;
    v_items_count INTEGER := 0;
    v_product RECORD;
    v_item_price NUMERIC;
    v_item_quantity NUMERIC;
    v_product_id UUID;
BEGIN
    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Se requiere al menos un item';
    END IF;

    SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0')
    INTO v_invoice_number;

    -- Pre-calculate totals
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1);
        v_item_price := COALESCE((v_item->>'unit_price')::NUMERIC, (v_item->>'price')::NUMERIC, 0);
        v_subtotal := v_subtotal + (v_item_quantity * v_item_price);
    END LOOP;

    v_tax := v_subtotal * 0.18;
    v_total := v_subtotal + v_tax;

    INSERT INTO invoices (organization_id, created_by, contact_id, invoice_number, status, issue_date, due_date, subtotal, tax, total, notes)
    VALUES (p_org_id, p_user_id, p_contact_id, v_invoice_number, 'draft', CURRENT_DATE, COALESCE(p_due_date, CURRENT_DATE + INTERVAL '30 days'), v_subtotal, v_tax, v_total, p_notes)
    RETURNING id INTO v_invoice_id;

    -- Insert items and adjust stock (products.stock_quantity)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1);
        v_item_price := COALESCE((v_item->>'unit_price')::NUMERIC, (v_item->>'price')::NUMERIC, 0);

        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
        VALUES (v_invoice_id, v_item->>'description', v_item_quantity, v_item_price, v_item_quantity * v_item_price);

        v_items_count := v_items_count + 1;

        -- Stock handling (support legacy inventory_id key, prefer product_id)
        v_product_id := COALESCE((v_item->>'product_id')::UUID, (v_item->>'inventory_id')::UUID);

        IF v_product_id IS NOT NULL THEN
            SELECT * INTO v_product
            FROM products
            WHERE id = v_product_id
              AND organization_id = p_org_id
              AND is_service = false
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Producto % no encontrado o no es físico', v_product_id;
            END IF;

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
$$ LANGUAGE plpgsql;

-- 3) Analytics: count physical products instead of legacy inventory
CREATE OR REPLACE FUNCTION update_analytics_cache()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_today DATE := CURRENT_DATE;
    v_stats JSONB;
    v_total_contacts INTEGER;
    v_total_sales DECIMAL(10,2);
    v_inventory_count INTEGER;
    v_sales_count INTEGER;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.organization_id;
    ELSE
        v_org_id := NEW.organization_id;
    END IF;

    IF v_org_id IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    SELECT COUNT(*) INTO v_total_contacts FROM contacts WHERE organization_id = v_org_id;

    SELECT COALESCE(SUM(total), 0), COUNT(*)
    INTO v_total_sales, v_sales_count
    FROM invoices WHERE organization_id = v_org_id AND (status = 'paid' OR status = 'sent');

    -- Count physical products as "inventory"
    SELECT COUNT(*) INTO v_inventory_count FROM products WHERE organization_id = v_org_id AND is_service = false;

    v_stats := jsonb_build_array(
        jsonb_build_object('title', 'Contactos Totales', 'value', v_total_contacts::TEXT, 'change', '+0%', 'changeType', 'neutral', 'icon', 'Users'),
        jsonb_build_object('title', 'Ventas del Mes', 'value', 'S/ ' || to_char(v_total_sales, 'FM999,999,990.00'), 'change', '+0%', 'changeType', 'positive', 'icon', 'DollarSign'),
        jsonb_build_object('title', 'Inventario Total', 'value', v_inventory_count::TEXT, 'change', 'Items', 'changeType', 'neutral', 'icon', 'Package'),
        jsonb_build_object('title', 'Facturas Generadas', 'value', v_sales_count::TEXT, 'change', '+0%', 'changeType', 'positive', 'icon', 'FileText')
    );

    INSERT INTO analytics_cache (organization_id, metric_name, metric_value, period, date)
    VALUES (v_org_id, 'dashboard_stats', v_stats, 'daily', v_today)
    ON CONFLICT (organization_id, metric_name, period, date)
    DO UPDATE SET metric_value = EXCLUDED.metric_value, created_at = NOW();

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers to use products instead of inventory
DROP TRIGGER IF EXISTS trigger_update_analytics_inventory ON inventory;
DROP TRIGGER IF EXISTS trigger_update_analytics_products ON products;

CREATE TRIGGER trigger_update_analytics_products
    AFTER INSERT OR UPDATE OR DELETE ON products FOR EACH ROW
    EXECUTE FUNCTION update_analytics_cache();

-- 4) Drop legacy inventory table (no production data)
DROP TABLE IF EXISTS inventory CASCADE;
