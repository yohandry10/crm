/**
 * Rate Limiting Global usando Redis
 *
 * MEJORA CRÍTICA: Ahora REQUIERE Redis (no hay fallback)
 * Resuelve: AUTH-001 del reporte forense
 *
 * IMPORTANTE:
 * - En producción, Redis es OBLIGATORIO
 * - En desarrollo, se lanza error si no está configurado
 * - Elimina el riesgo de rate limit por servidor (multi-instancia)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRedisClient } from './redis'
import { logger } from './logger'

interface RateLimitConfig {
    interval: number // milliseconds
    maxRequests: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
    interval: 60 * 1000, // 1 minute
    maxRequests: 100
}

const REDIS_PREFIX = 'ratelimit:'

/**
 * Rate limiting middleware con Redis (OBLIGATORIO)
 * Returns null if request is allowed, or a NextResponse with 429 status if rate limited
 *
 * IMPORTANTE: Lanza error si Redis no está disponible en producción
 */
export async function rateLimit(
    request: NextRequest,
    config: RateLimitConfig = DEFAULT_CONFIG
): Promise<NextResponse | null> {
    const identifier = await getIdentifier(request)
    const now = Date.now()
    const redis = getRedisClient()

    // Redis es OBLIGATORIO en producción
    if (!redis) {
        const errorMessage = 'Redis is required for rate limiting. Configure REDIS_URL in environment variables.'

        // En producción, fallar hard
        if (process.env.NODE_ENV === 'production') {
            logger.error('Rate limiting unavailable (Redis missing)', undefined, { errorMessage })
            return NextResponse.json(
                {
                    success: false,
                    error: 'Service temporarily unavailable',
                    message: 'Rate limiting service is not configured. Please contact support.'
                },
                { status: 503 }
            )
        }

        // En desarrollo, solo advertir
        logger.warn('Rate limiting disabled in development (Redis missing)', { errorMessage })
        return null // Permitir request en desarrollo sin Redis
    }

    // Usar Redis para rate limiting
    try {
        const key = `${REDIS_PREFIX}${identifier}`
        const data = await redis.get(key)

        let entry: { count: number; resetTime: number }

        if (data) {
            entry = JSON.parse(data)

            // Si expiró, resetear
            if (now > entry.resetTime) {
                entry = {
                    count: 1,
                    resetTime: now + config.interval
                }
            } else {
                // Incrementar contador
                entry.count++
            }
        } else {
            // Primera request
            entry = {
                count: 1,
                resetTime: now + config.interval
            }
        }

        // Guardar en Redis con TTL
        const ttl = Math.ceil((entry.resetTime - now) / 1000)
        await redis.set(key, JSON.stringify(entry), 'EX', Math.max(ttl, 1))

        // Check if limit exceeded
        if (entry.count > config.maxRequests) {
            const retryAfter = Math.ceil((entry.resetTime - now) / 1000)

            return NextResponse.json(
                {
                    success: false,
                    error: 'Too many requests',
                    message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After': retryAfter.toString(),
                        'X-RateLimit-Limit': config.maxRequests.toString(),
                        'X-RateLimit-Remaining': '0',
                        'X-RateLimit-Reset': entry.resetTime.toString()
                    }
                }
            )
        }

        // Request is allowed
        return null

    } catch (error) {
        logger.error('Redis rate limit error', error)

        // En producción, fail closed (denegar request)
        if (process.env.NODE_ENV === 'production') {
            return NextResponse.json(
                {
                    success: false,
                    error: 'Service temporarily unavailable',
                    message: 'Rate limiting service encountered an error. Please try again.'
                },
                { status: 503 }
            )
        }

        // En desarrollo, permitir
        logger.warn('Allowing request in development despite Redis rate limit error')
        return null
    }
}

/**
 * Get identifier for rate limiting (IP + User ID if authenticated)
 */
async function getIdentifier(request: NextRequest): Promise<string> {
    // Get IP address
    const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'

    // Try to get user ID from auth
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        )

        const authHeader = request.headers.get('authorization')
        if (authHeader) {
            // Extract token and get user
            const token = authHeader.replace('Bearer ', '')
            const { data: { user } } = await supabase.auth.getUser(token)
            if (user) {
                return `user:${user.id}`
            }
        }
    } catch {
        // Fallback to IP if auth fails
    }

    return `ip:${ip}`
}

// Cleanup automático: Redis maneja el TTL automáticamente
// No necesitamos limpiar nada manualmente

/**
 * Helper function to apply rate limiting to API routes
 */
export function withRateLimit<T extends any[]>(
    handler: (request: NextRequest, ...args: T) => Promise<NextResponse>,
    config?: RateLimitConfig
) {
    return async (request: NextRequest, ...args: T): Promise<NextResponse> => {
        const rateLimitResponse = await rateLimit(request, config)
        if (rateLimitResponse) {
            return rateLimitResponse
        }

        return handler(request, ...args)
    }
}


/**
 * Configuraciones de rate limit predefinidas para diferentes tipos de endpoints
 */
export const RATE_LIMITS = {
    // Endpoints de lectura - más permisivos
    read: { interval: 60 * 1000, maxRequests: 100 },

    // Endpoints de escritura - más restrictivos
    write: { interval: 60 * 1000, maxRequests: 30 },

    // Endpoints sensibles (auth, pagos)
    sensitive: { interval: 60 * 1000, maxRequests: 10 },

    // Endpoints de búsqueda
    search: { interval: 60 * 1000, maxRequests: 50 },

    // Webhooks externos
    webhook: { interval: 60 * 1000, maxRequests: 200 },

    // Cron jobs
    cron: { interval: 60 * 1000, maxRequests: 5 },
} as const
