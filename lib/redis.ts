/**
 * Cliente de Redis para rate limiting y caché
 * Singleton pattern para reutilizar conexión
 */

import Redis, { type RedisOptions } from 'ioredis'
import { logger } from './logger'

let redis: Redis | null = null

/**
 * Obtiene instancia de Redis (Singleton)
 */
export function getRedisClient(): Redis | null {
  // Si no hay configuración de Redis, retornar null (fallback a memoria)
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    logger.warn('Redis not configured. Using in-memory fallback (not recommended for production)')
    return null
  }

  // Si ya existe y está conectado, retornar la instancia
  if (redis) {
    return redis
  }

  try {
    const options: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Reintentar con backoff exponencial
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: false, // ✅ Conectar inmediatamente una sola vez
      enableReadyCheck: true,
      keepAlive: 30000, // ✅ Mantener conexión viva
      reconnectOnError: (err) => {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          return true
        }
        return false
      },
    }

    // Crear cliente solo si hay URL o host explícito
    const redisConfig = process.env.REDIS_URL
      ? process.env.REDIS_URL
      : process.env.REDIS_HOST
        ? {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
          }
        : null

    if (!redisConfig) {
      logger.warn('Redis config missing; skipping Redis client initialization')
      return null
    }

    redis =
      typeof redisConfig === 'string'
        ? new Redis(redisConfig, options)
        : new Redis({ ...redisConfig, ...options })

    // Eventos de conexión (solo para debugging)
    redis.on('connect', () => {
      logger.info('Redis connected (singleton)')
    })

    redis.on('error', (err) => {
      logger.error('Redis error', err, { message: err.message })
    })

    redis.on('close', () => {
      logger.warn('Redis disconnected')
      redis = null // ✅ Limpiar singleton si se cierra
    })

    return redis
  } catch (error) {
    logger.error('Error creating Redis client', error)
    redis = null
    return null
  }
}

/**
 * Cierra la conexión de Redis (usar en cleanup)
 */
export async function closeRedis() {
  if (redis) {
    await redis.quit()
    redis = null
  }
}

/**
 * Health check de Redis
 */
export async function isRedisHealthy(): Promise<boolean> {
  const client = getRedisClient()
  if (!client) return false

  try {
    const pong = await client.ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}

// Exportar instancia para uso directo
export const redisClient = getRedisClient()
