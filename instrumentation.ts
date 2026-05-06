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

export async function onRequestError(error: unknown, request: any, context: any) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const err =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) }

  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'error',
      message: 'Unhandled request error',
      context: {
        route: context?.routePath || request?.path || request?.url || 'unknown',
        method: request?.method || 'REQUEST',
        error: err,
      },
    })
  )
}
