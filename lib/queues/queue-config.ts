/**
 * Configuración centralizada para BullMQ
 *
 * Este archivo define:
 * - Conexión a Redis compartida
 * - Configuraciones por defecto de colas
 * - Configuraciones de reintentos y timeouts
 */

import { QueueOptions, WorkerOptions } from 'bullmq'
import { getRedisClient } from '../redis'
import { logger } from '../logger'

/**
 * Obtiene la configuración de conexión a Redis para BullMQ
 * BullMQ requiere un formato específico diferente a ioredis
 */
export function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL
  const redisHost = process.env.REDIS_HOST || 'localhost'
  const redisPort = parseInt(process.env.REDIS_PORT || '6379')
  const redisPassword = process.env.REDIS_PASSWORD
  const redisUsername = process.env.REDIS_USERNAME

  // Si hay URL completa, usarla
  if (redisUrl && redisUrl.includes('://')) {
    const url = new URL(redisUrl)
    const passwordFromUrl = url.password ? decodeURIComponent(url.password) : undefined
    const usernameFromUrl = url.username ? decodeURIComponent(url.username) : undefined
    const isTls = url.protocol === 'rediss:'

    return {
      host: url.hostname,
      port: parseInt(url.port || '6379'),
      // Allow explicit env override, but default to what is embedded in REDIS_URL (Upstash).
      username: redisUsername || usernameFromUrl || undefined,
      password: redisPassword || passwordFromUrl || undefined,
      // Upstash uses TLS (rediss://). BullMQ/ioredis needs this option when not using URL string directly.
      tls: isTls ? {} : undefined,
    }
  }

  if (redisUrl) {
    // Non-URL (legacy) value: fall back to host/port env variables.
    return {
      host: redisHost,
      port: redisPort,
      username: redisUsername,
      password: redisPassword,
    }
  }

  // Configuración por partes
  return {
    host: redisHost,
    port: redisPort,
    username: redisUsername,
    password: redisPassword,
  }
}

/**
 * Configuración por defecto para todas las colas
 *
 * Explicación de opciones:
 * - connection: Conexión a Redis compartida
 * - defaultJobOptions: Opciones que se aplican a todos los jobs
 *   - attempts: Cuántas veces reintentar si falla (3 = intenta 3 veces total)
 *   - backoff: Estrategia de espera entre reintentos
 *     - type: 'exponential' = espera crece: 2s, 4s, 8s, 16s...
 *     - delay: tiempo base en milisegundos
 *   - removeOnComplete: Borrar jobs completados después de X tiempo
 *   - removeOnFail: Borrar jobs fallidos después de X tiempo
 */
export const defaultQueueConfig: QueueOptions = {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3, // Reintentar hasta 3 veces
    backoff: {
      type: 'exponential', // Tiempo de espera crece exponencialmente
      delay: 2000, // Primer reintento: 2 segundos, luego 4s, 8s, 16s...
    },
    removeOnComplete: {
      age: 24 * 60 * 60, // Borrar jobs completados después de 24 horas (en segundos)
      count: 1000, // Mantener máximo 1000 jobs completados
    },
    removeOnFail: {
      age: 7 * 24 * 60 * 60, // Mantener jobs fallidos por 7 días (para debugging)
    },
  },
}

/**
 * Configuración por defecto para todos los workers (procesadores)
 *
 * Explicación de opciones:
 * - connection: Misma conexión a Redis
 * - concurrency: Cuántos jobs procesar simultáneamente
 *   - 5 = puede procesar hasta 5 workflows al mismo tiempo
 * - lockDuration: Tiempo máximo que un worker puede "retener" un job
 *   - 30000ms = 30 segundos, si tarda más, otro worker puede tomarlo
 */
export const defaultWorkerConfig: WorkerOptions = {
  connection: getRedisConnection(),
  concurrency: 5, // Procesar hasta 5 jobs simultáneamente por worker
  lockDuration: 30000, // 30 segundos de lock por job
}

/**
 * Configuraciones específicas por tipo de job
 * Puedes sobrescribir estas configuraciones al crear jobs individuales
 */
export const JOB_CONFIGS = {
  // Workflows: pueden tardar más, necesitan más reintentos
  workflow: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 5000, // 5s, 10s, 20s, 40s...
    },
    timeout: 60000, // Máximo 1 minuto de ejecución
  },

  // Emails: rápidos, pocos reintentos
  email: {
    attempts: 3,
    backoff: {
      type: 'exponential' as const,
      delay: 1000, // 1s, 2s, 4s...
    },
    timeout: 10000, // Máximo 10 segundos
  },

  // Importaciones: pueden tardar mucho, no reintentar tanto
  import: {
    attempts: 2,
    backoff: {
      type: 'fixed' as const,
      delay: 10000, // Siempre esperar 10 segundos entre reintentos
    },
    timeout: 300000, // Máximo 5 minutos
  },

  // Webhooks: fallan seguido, reintentar con backoff agresivo
  webhook: {
    attempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 2000, // 2s, 4s, 8s, 16s, 32s...
    },
    timeout: 30000, // Máximo 30 segundos
  },
} as const

/**
 * Nombres de las colas (para evitar typos)
 */
export const QUEUE_NAMES = {
  WORKFLOWS: 'workflows',
  EMAILS: 'emails',
  IMPORTS: 'imports',
  WEBHOOKS: 'webhooks',
  REPORTS: 'reports',
} as const

/**
 * Helper para verificar que Redis está disponible
 * Lanza error si estamos en producción sin Redis
 */
export function ensureRedisAvailable() {
  const redis = getRedisClient()

  if (!redis && process.env.NODE_ENV === 'production') {
    throw new Error(
      '🔴 Redis es OBLIGATORIO en producción para BullMQ. ' +
        'Por favor configura REDIS_URL o REDIS_HOST en las variables de entorno.'
    )
  }

  if (!redis) {
    logger.warn(
      'Redis not available. BullMQ will not work. This is OK in local development, but required in production.'
    )
  }

  return redis
}
