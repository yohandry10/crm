/**
 * Circuit Breaker Pattern
 *
 * Implementa el patrón Circuit Breaker para proteger el sistema
 * de servicios externos que fallan repetidamente.
 *
 * Estados:
 * - CLOSED: Todo funciona normal
 * - OPEN: Detectó muchos fallos, deja de intentar (fail fast)
 * - HALF_OPEN: Permite algunos requests de prueba
 *
 * Casos de uso:
 * - Llamadas a webhooks externos
 * - APIs de terceros (Gemini, Culqi, Twilio, etc.)
 * - Servicios que pueden estar caídos
 *
 * Beneficios:
 * - Evita saturar servicios caídos
 * - Respuesta rápida en caso de fallo (fail fast)
 * - Auto-recuperación cuando el servicio vuelve
 * - Métricas de confiabilidad
 */

import CircuitBreaker from 'opossum'
import { addSpanEvent, addSpanAttributes } from './observability/otel'
import { logger } from './logger'

/**
 * Opciones del Circuit Breaker
 */
interface CircuitBreakerOptions {
  /**
   * Timeout en ms (default: 10000)
   * Después de este tiempo se considera fallo
   */
  timeout?: number

  /**
   * Umbral de errores (default: 50%)
   * Si este % de requests fallan, abre el circuito
   */
  errorThresholdPercentage?: number

  /**
   * Volumen mínimo de requests (default: 10)
   * Necesita al menos este número de requests para evaluar
   */
  requestVolumeThreshold?: number

  /**
   * Tiempo en modo OPEN (default: 60000ms = 1 minuto)
   * Después de este tiempo, intenta requests de prueba
   */
  resetTimeout?: number

  /**
   * Nombre del circuito (para logs y métricas)
   */
  name?: string
}

/**
 * Estadísticas del Circuit Breaker
 */
interface CircuitBreakerStats {
  name: string
  state: 'OPEN' | 'CLOSED' | 'HALF_OPEN'
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  errorRate: number
  lastFailureTime?: Date
  timesOpened: number
}

// Cache de circuit breakers por nombre
const breakers = new Map<string, CircuitBreaker>()

/**
 * Obtiene o crea un Circuit Breaker
 *
 * @param name - Nombre único del circuit breaker
 * @param action - Función a proteger con circuit breaker
 * @param options - Opciones de configuración
 * @returns Circuit Breaker configurado
 */
export function getCircuitBreaker<T, Args extends any[]>(
  name: string,
  action: (...args: Args) => Promise<T>,
  options: CircuitBreakerOptions = {}
): CircuitBreaker<Args, T> {
  // Si ya existe, retornarlo
  if (breakers.has(name)) {
    return breakers.get(name) as CircuitBreaker<Args, T>
  }

  // Crear nuevo circuit breaker
  const breaker = new CircuitBreaker(action, {
    timeout: options.timeout || 10000, // 10 segundos
    errorThresholdPercentage: options.errorThresholdPercentage || 50, // 50% de errores
    requestVolumeThreshold: options.requestVolumeThreshold || 10, // Mínimo 10 requests
    resetTimeout: options.resetTimeout || 60000, // 1 minuto
    name: name,
    // Caché de resultados exitosos (opcional)
    // cache: true,
  })

  // Event listeners para logging y telemetría
  breaker.on('open', () => {
    logger.warn('Circuit breaker opened', { circuit_name: name })

    addSpanEvent('circuit_breaker.opened', {
      circuit_name: name,
    })
  })

  breaker.on('halfOpen', () => {
    logger.info('Circuit breaker half-open', { circuit_name: name })

    addSpanEvent('circuit_breaker.half_opened', {
      circuit_name: name,
    })
  })

  breaker.on('close', () => {
    logger.info('Circuit breaker closed', { circuit_name: name })

    addSpanEvent('circuit_breaker.closed', {
      circuit_name: name,
    })
  })

  breaker.on('success', (_result: unknown, latency: number) => {
    addSpanAttributes({
      [`circuit_breaker.${name}.success`]: true,
      [`circuit_breaker.${name}.latency_ms`]: latency,
    })
  })

  breaker.on('failure', (error: Error) => {
    logger.error('Circuit breaker failure', error, { circuit_name: name })

    addSpanAttributes({
      [`circuit_breaker.${name}.success`]: false,
      [`circuit_breaker.${name}.error`]: error.message,
    })
  })

  breaker.on('timeout', () => {
    logger.warn('Circuit breaker timeout', { circuit_name: name })

    addSpanEvent('circuit_breaker.timeout', {
      circuit_name: name,
    })
  })

  breaker.on('reject', () => {
    logger.warn('Circuit breaker rejected request', { circuit_name: name })

    addSpanEvent('circuit_breaker.rejected', {
      circuit_name: name,
    })
  })

  // Guardar en caché
  breakers.set(name, breaker)

  return breaker as CircuitBreaker<Args, T>
}

/**
 * Ejecuta una función protegida por circuit breaker
 *
 * Uso:
 * ```typescript
 * const result = await withCircuitBreaker(
 *   'payment-provider',
 *   () => fetch('https://api.culqi.com', {...}),
 *   { timeout: 5000 }
 * )
 * ```
 */
export async function withCircuitBreaker<T>(
  name: string,
  action: () => Promise<T>,
  options: CircuitBreakerOptions = {}
): Promise<T> {
  const breaker = getCircuitBreaker(name, action, options)

  try {
    const result = await breaker.fire()
    return result
  } catch (error: any) {
    // El circuit breaker puede lanzar errores específicos
    if (error.message === 'Breaker is open') {
      throw new Error(
        `El servicio ${name} está temporalmente no disponible (circuit breaker abierto). ` +
          `Inténtalo de nuevo en unos minutos.`
      )
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'EOPENBREAKER') {
      throw new Error(`Timeout al llamar al servicio ${name}`)
    }

    throw error
  }
}

/**
 * Obtiene estadísticas de un circuit breaker
 */
export function getCircuitBreakerStats(name: string): CircuitBreakerStats | null {
  const breaker = breakers.get(name)
  if (!breaker) return null

  const stats = breaker.stats

  return {
    name,
    state: breaker.opened
      ? 'OPEN'
      : breaker.halfOpen
        ? 'HALF_OPEN'
        : 'CLOSED',
    totalRequests: stats.fires,
    successfulRequests: stats.successes,
    failedRequests: stats.failures,
    errorRate: stats.fires > 0 ? (stats.failures / stats.fires) * 100 : 0,
    lastFailureTime: stats.failures > 0 ? new Date() : undefined,
    timesOpened: stats.opens || 0,
  }
}

/**
 * Obtiene estadísticas de todos los circuit breakers
 */
export function getAllCircuitBreakersStats(): CircuitBreakerStats[] {
  return Array.from(breakers.keys()).map((name) => getCircuitBreakerStats(name)!)
}

/**
 * Reinicia manualmente un circuit breaker (útil para testing)
 */
export function resetCircuitBreaker(name: string): void {
  const breaker = breakers.get(name)
  if (breaker) {
    breaker.close()
    logger.info('Circuit breaker reset', { circuit_name: name })
  }
}

/**
 * Limpia todos los circuit breakers (útil para testing)
 */
export function clearAllCircuitBreakers(): void {
  breakers.forEach((breaker) => breaker.shutdown())
  breakers.clear()
  logger.info('All circuit breakers cleared')
}

// ======================================
// CIRCUIT BREAKERS PRE-CONFIGURADOS
// ======================================

/**
 * Circuit Breaker para webhooks
 *
 * Configuración optimizada para llamadas HTTP a webhooks externos
 */
export const webhookCircuitBreaker = <T>(
  webhookUrl: string,
  action: () => Promise<T>
) => {
  // Usar el dominio como nombre único
  const domain = new URL(webhookUrl).hostname
  const name = `webhook:${domain}`

  return withCircuitBreaker(name, action, {
    timeout: 30000, // 30 segundos (webhooks pueden ser lentos)
    errorThresholdPercentage: 60, // Tolerar más errores
    requestVolumeThreshold: 5, // Solo 5 requests para evaluar
    resetTimeout: 120000, // 2 minutos antes de reintentar
  })
}

/**
 * Circuit Breaker para APIs de terceros (Gemini, Culqi, Twilio, etc.)
 */
export const externalAPICircuitBreaker = <T>(
  serviceName: string,
  action: () => Promise<T>
) => {
  return withCircuitBreaker(`external-api:${serviceName}`, action, {
    timeout: 15000, // 15 segundos
    errorThresholdPercentage: 70, // APIs pueden tener errores esporádicos
    requestVolumeThreshold: 10,
    resetTimeout: 90000, // 1.5 minutos
  })
}

/**
 * Circuit Breaker para bases de datos externas
 */
export const databaseCircuitBreaker = <T>(
  dbName: string,
  action: () => Promise<T>
) => {
  return withCircuitBreaker(`database:${dbName}`, action, {
    timeout: 5000, // 5 segundos (queries deben ser rápidas)
    errorThresholdPercentage: 80, // Tolerancia alta (puede ser temporal)
    requestVolumeThreshold: 20,
    resetTimeout: 30000, // 30 segundos (DB suele recuperarse rápido)
  })
}
