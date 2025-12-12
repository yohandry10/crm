/**
 * Migración: Agregar idempotency_key a tabla payments
 * Resuelve: PAY-001 del reporte forense (prevención de pagos duplicados)
 *
 * Fecha: 2025-12-12
 * Criticidad: ALTA - Previene pérdidas financieras
 */

-- 1. Agregar columna idempotency_key a tabla payments
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- 2. Crear índice único para prevenir duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key
ON payments(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 3. Agregar índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key_created
ON payments(idempotency_key, created_at)
WHERE idempotency_key IS NOT NULL;

-- 4. Agregar comentario para documentación
COMMENT ON COLUMN payments.idempotency_key IS 'Clave de idempotencia para prevenir pagos duplicados. Debe ser único por request del cliente.';

-- 5. Agregar constraint check (opcional, para validar formato)
ALTER TABLE payments
ADD CONSTRAINT chk_idempotency_key_format
CHECK (
    idempotency_key IS NULL OR
    (length(idempotency_key) >= 16 AND length(idempotency_key) <= 255)
);

-- 6. Función para limpiar idempotency keys antiguas (opcional - ejecutar como cron)
CREATE OR REPLACE FUNCTION cleanup_old_idempotency_keys()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Eliminar idempotency keys de pagos con más de 30 días
    -- Esto permite reutilizar la misma key después de 30 días
    UPDATE payments
    SET idempotency_key = NULL
    WHERE idempotency_key IS NOT NULL
      AND created_at < NOW() - INTERVAL '30 days';
END;
$$;

COMMENT ON FUNCTION cleanup_old_idempotency_keys() IS 'Limpia idempotency keys de pagos con más de 30 días para permitir reutilización';

-- Ejecutar la función manualmente o configurar como cron job
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 2 * * *', 'SELECT cleanup_old_idempotency_keys()');
