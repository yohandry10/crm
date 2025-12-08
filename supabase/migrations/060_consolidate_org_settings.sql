-- =====================================================
-- MIGRACIÓN: Consolidar organization_settings en organizations
-- Eliminar tabla organization_settings y mover todo a organizations
-- =====================================================

-- 1. Agregar columnas faltantes a organizations
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sunat_usuario_sol TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS sunat_clave_sol TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS certificado_digital TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ose_provider TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS ose_api_key TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS serie_factura TEXT DEFAULT 'F001';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS serie_boleta TEXT DEFAULT 'B001';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS serie_nota_credito TEXT DEFAULT 'FC01';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS default_tax_rate DECIMAL(5,2) DEFAULT 18.00;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_new_lead BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_task_due BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_payment_received BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS notify_invoice_overdue BOOLEAN DEFAULT TRUE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- 2. Migrar datos existentes de organization_settings a organizations
UPDATE organizations o
SET 
    sunat_usuario_sol = COALESCE(o.sunat_usuario_sol, os.sunat_usuario_sol),
    sunat_clave_sol = COALESCE(o.sunat_clave_sol, os.sunat_clave_sol),
    certificado_digital = COALESCE(o.certificado_digital, os.certificado_digital),
    ose_provider = COALESCE(o.ose_provider, os.ose_provider),
    ose_api_key = COALESCE(o.ose_api_key, os.ose_api_key),
    serie_factura = COALESCE(os.serie_factura, o.serie_factura, 'F001'),
    serie_boleta = COALESCE(os.serie_boleta, o.serie_boleta, 'B001'),
    serie_nota_credito = COALESCE(os.serie_nota_credito, o.serie_nota_credito, 'FC01'),
    currency = COALESCE(os.default_currency, o.currency, 'PEN'),
    default_tax_rate = COALESCE(os.default_tax_rate, o.default_tax_rate, 18.00),
    notify_new_lead = COALESCE(os.notify_new_lead, o.notify_new_lead, TRUE),
    notify_task_due = COALESCE(os.notify_task_due, o.notify_task_due, TRUE),
    notify_payment_received = COALESCE(os.notify_payment_received, o.notify_payment_received, TRUE),
    notify_invoice_overdue = COALESCE(os.notify_invoice_overdue, o.notify_invoice_overdue, TRUE),
    -- También migrar datos de empresa si organization_settings los tiene
    name = COALESCE(o.name, os.company_name),
    ruc = COALESCE(o.ruc, os.company_ruc),
    address = COALESCE(o.address, os.company_address),
    phone = COALESCE(o.phone, os.company_phone),
    email = COALESCE(o.email, os.company_email),
    timezone = COALESCE(os.timezone, o.timezone, 'America/Lima')
FROM organization_settings os
WHERE os.organization_id = o.id;

-- 3. Eliminar la tabla organization_settings
DROP TABLE IF EXISTS organization_settings CASCADE;

-- 4. Comentario para referencia
COMMENT ON TABLE organizations IS 'Tabla principal de organizaciones/tenants. Incluye toda la configuración (antes en organization_settings)';
