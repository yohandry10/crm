-- =====================================================
-- ANALYTICS AUTOMATION (MULTI-TENANT)
-- =====================================================

-- Function to update analytics cache (MULTI-TENANT)
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
    -- Handle DELETE case where NEW is null
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

    SELECT COUNT(*) INTO v_inventory_count FROM inventory WHERE organization_id = v_org_id;

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

DROP TRIGGER IF EXISTS trigger_update_analytics_contacts ON contacts;
CREATE TRIGGER trigger_update_analytics_contacts
    AFTER INSERT OR UPDATE OR DELETE ON contacts FOR EACH ROW
    EXECUTE FUNCTION update_analytics_cache();

DROP TRIGGER IF EXISTS trigger_update_analytics_invoices ON invoices;
CREATE TRIGGER trigger_update_analytics_invoices
    AFTER INSERT OR UPDATE OR DELETE ON invoices FOR EACH ROW
    EXECUTE FUNCTION update_analytics_cache();

DROP TRIGGER IF EXISTS trigger_update_analytics_inventory ON inventory;
CREATE TRIGGER trigger_update_analytics_inventory
    AFTER INSERT OR UPDATE OR DELETE ON inventory FOR EACH ROW
    EXECUTE FUNCTION update_analytics_cache();
