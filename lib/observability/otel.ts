/**
 * OpenTelemetry Configuration
 *
 * Configuración centralizada de telemetría distribuida
 *
 * Características:
 * - Auto-instrumentación de HTTP, PostgreSQL, Redis
 * - Exportación a Jaeger, Honeycomb, Datadog, etc.
 * - Sampling configurable
 * - Context propagation automático
 * - Métricas y logs estructurados
 */

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { logger } from '../logger'

/**
 * Crea un exporter de traces según configuración
 */
function createTraceExporter() {
  // Si hay URL de OTLP (Honeycomb, Jaeger, etc.)
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
      headers: {
        'x-honeycomb-team': process.env.HONEYCOMB_API_KEY || '',
        'x-honeycomb-dataset': process.env.HONEYCOMB_DATASET || 'crm-production',
      },
    })
  }

  // Por defecto, logs a consola (desarrollo)
  return undefined // Usa ConsoleSpanExporter por defecto
}

/**
 * Registra OpenTelemetry SDK
 */
export async function registerOtel() {
  // Solo si está habilitado
  if (process.env.OTEL_ENABLED !== 'true') {
    logger.info('OpenTelemetry disabled (set OTEL_ENABLED=true to enable)')
    return
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'crm-ai-peru',
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    }),

    // Exporter de traces
    traceExporter: createTraceExporter(),

    // Auto-instrumentación de librerías comunes
    instrumentations: [
      getNodeAutoInstrumentations({
        // Configuración de instrumentaciones
        '@opentelemetry/instrumentation-http': {
          // No trazar health checks
          ignoreIncomingRequestHook: (req) => {
            return Boolean(req.url && (req.url.includes('/health') || req.url.includes('/api/health')))
          },
        },
        '@opentelemetry/instrumentation-pg': {
          // Incluir queries SQL en spans (útil para debugging)
          enhancedDatabaseReporting: true,
        },
        '@opentelemetry/instrumentation-redis': {
          // Incluir comandos Redis
          dbStatementSerializer: (cmdName, cmdArgs) => {
            return `${cmdName} ${cmdArgs.slice(0, 3).join(' ')}`
          },
        },
      }),
    ],

    // Sampling: en desarrollo 100%, en producción 10%
    // Esto reduce costos pero mantiene visibilidad
    // sampler: new TraceIdRatioBasedSampler(
    //   process.env.NODE_ENV === 'production' ? 0.1 : 1.0
    // ),
  })

  try {
    await sdk.start()
    logger.info('OpenTelemetry started')

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => logger.info('OpenTelemetry shutdown complete'))
        .catch((err) => logger.error('Error shutting down OpenTelemetry', err))
    })
  } catch (error) {
    logger.error('Error starting OpenTelemetry', error)
  }
}

/**
 * Helper para crear spans personalizados
 *
 * Uso:
 * ```typescript
 * await withSpan('procesando-workflow', async (span) => {
 *   span.setAttribute('workflow.id', workflowId)
 *   span.setAttribute('workflow.actions', actions.length)
 *
 *   await processWorkflow()
 *
 *   span.setStatus({ code: SpanStatusCode.OK })
 * })
 * ```
 */
export async function withSpan<T>(
  name: string,
  fn: (span: ReturnType<typeof trace.getActiveSpan>) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  const tracer = trace.getTracer('crm-ai-peru')

  return tracer.startActiveSpan(name, async (span) => {
    try {
      // Agregar atributos iniciales
      if (attributes) {
        Object.entries(attributes).forEach(([key, value]) => {
          span.setAttribute(key, value)
        })
      }

      // Ejecutar función
      const result = await fn(span)

      // Marcar como exitoso
      span.setStatus({ code: SpanStatusCode.OK })

      return result
    } catch (error: any) {
      // Registrar error
      span.recordException(error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      })

      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Helper para agregar atributos al span activo
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>) {
  const span = trace.getActiveSpan()
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value)
    })
  }
}

/**
 * Helper para registrar eventos en el span activo
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>) {
  const span = trace.getActiveSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

/**
 * Helper para marcar un span como error
 */
export function markSpanAsError(error: Error) {
  const span = trace.getActiveSpan()
  if (span) {
    span.recordException(error)
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error.message,
    })
  }
}

/**
 * Obtiene el trace ID actual (útil para logs correlacionados)
 */
export function getCurrentTraceId(): string | undefined {
  const span = trace.getActiveSpan()
  if (span) {
    const spanContext = span.spanContext()
    return spanContext.traceId
  }
  return undefined
}
