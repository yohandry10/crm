-- =====================================================
-- INVOICE ATOMIC FUNCTION (MULTI-TENANT)
-- =====================================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id),
    type TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    previous_quantity DECIMAL(10,2),
    new_quantity DECIMAL(10,2),
    reason TEXT,
    reference_type TEXT,
    reference_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_movements_org ON inventory_movements(organization_id);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members can view inventory_movements" ON inventory_movements FOR SELECT USING (is_org_member(organization_id));
CREATE POLICY "Org members can insert inventory_movements" ON inventory_movements FOR INSERT WITH CHECK (is_org_member(organization_id));
CREATE POLICY "Org members can update inventory_movements" ON inventory_movements FOR UPDATE USING (is_org_member(organization_id));
CREATE POLICY "Org members can delete inventory_movements" ON inventory_movements FOR DELETE USING (is_org_member(organization_id));

-- Atomic invoice creation function (MULTI-TENANT)
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
    v_inventory_item RECORD;
    v_item_price NUMERIC;
    v_item_quantity NUMERIC;
BEGIN
    -- Validate required parameters
    IF p_org_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'Se requiere al menos un item';
    END IF;

    SELECT 'INV-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(NEXTVAL('invoice_number_seq')::TEXT, 5, '0')
    INTO v_invoice_number;

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

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_item_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1);
        v_item_price := COALESCE((v_item->>'unit_price')::NUMERIC, (v_item->>'price')::NUMERIC, 0);

        INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total)
        VALUES (v_invoice_id, v_item->>'description', v_item_quantity, v_item_price, v_item_quantity * v_item_price);

        v_items_count := v_items_count + 1;

        IF v_item->>'inventory_id' IS NOT NULL THEN
            SELECT * INTO v_inventory_item FROM inventory
            WHERE id = (v_item->>'inventory_id')::UUID AND organization_id = p_org_id FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Producto de inventario % no encontrado', v_item->>'inventory_id';
            END IF;

            IF v_inventory_item.quantity < v_item_quantity THEN
                RAISE EXCEPTION 'Stock insuficiente para %', v_inventory_item.product_name;
            END IF;

            UPDATE inventory SET quantity = quantity - v_item_quantity, updated_at = NOW()
            WHERE id = v_inventory_item.id;

            INSERT INTO inventory_movements (organization_id, inventory_id, created_by, type, quantity, previous_quantity, new_quantity, reason, reference_type, reference_id)
            VALUES (p_org_id, v_inventory_item.id, p_user_id, 'out', v_item_quantity, v_inventory_item.quantity, v_inventory_item.quantity - v_item_quantity, 'Venta - Factura', 'invoice', v_invoice_id);
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_invoice_id, v_invoice_number, v_total, v_items_count;
END;
$$ LANGUAGE plpgsql;
