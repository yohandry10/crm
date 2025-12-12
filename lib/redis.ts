/**
 * Cliente de Redis para rate limiting y caché
 * Singleton pattern para reutilizar conexión
 */

import Redis from 'ioredis'

let redis: Redis | null = null

/**
 * Obtiene instancia de Redis (Singleton)
 */
export function getRedisClient(): Redis | null {
  // Si no hay configuración de Redis, retornar null (fallback a memoria)
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    console.warn('⚠️  Redis no configurado. Usando rate limiting en memoria (NO recomendado para producción)')
    return null
  }

  if (redis) {
    return redis
  }

  try {
    // Crear cliente con URL o con host/port separados
    const redisConfig = process.env.REDIS_URL
      ? process.env.REDIS_URL
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
        }

    redis = new Redis(redisConfig, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Reintentar con backoff exponencial
        const delay = Math.min(times * 50, 2000)
        return delay
      },
      lazyConnect: true, // Conectar bajo demanda
      enableReadyCheck: true,
      reconnectOnError: (err) => {
        const targetError = 'READONLY'
        if (err.message.includes(targetError)) {
          // Reconectar si Redis está en modo readonly
          return true
        }
        return false
      },
    })

    // Eventos de conexión
    redis.on('connect', () => {
      console.log('✅ Redis conectado')
    })

    redis.on('error', (err) => {
      console.error('❌ Redis error:', err.message)
    })

    redis.on('close', () => {
      console.warn('⚠️  Redis desconectado')
    })

    // Conectar inmediatamente
    redis.connect().catch((err) => {
      console.error('❌ Error conectando a Redis:', err)
      redis = null
    })

    return redis
  } catch (error) {
    console.error('❌ Error creando cliente Redis:', error)
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
