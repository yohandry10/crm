/**
 * OpenTelemetry Instrumentation
 *
 * Configuración de telemetría distribuida para Next.js
 *
 * Este archivo se ejecuta automáticamente antes de que Next.js inicie.
 * Proporciona:
 * - Tracing de requests HTTP
 * - Tracing de queries a Supabase/PostgreSQL
 * - Tracing de Redis operations
 * - Tracing de BullMQ jobs
 * - Métricas de performance
 *
 * Más info: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Evitar cargar dependencias de OTEL (y sus warnings) cuando está deshabilitado
    if (process.env.OTEL_ENABLED !== 'true') return

    const { registerOtel } = await import('./lib/observability/otel')
    await registerOtel()
  }
}
