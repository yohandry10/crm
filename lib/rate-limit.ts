/**
 * Rate Limiting Global usando Redis
 *
 * MEJORA CRÍTICA: Ahora usa Redis en lugar de Map en memoria
 * Resuelve: AUTH-001 del reporte forense
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getRedisClient } from './redis'

interface RateLimitConfig {
    interval: number // milliseconds
    maxRequests: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
    interval: 60 * 1000, // 1 minute
    maxRequests: 100
}

// Fallback: In-memory store (solo si Redis no está disponible)
const rateLimitStoreMemory = new Map<string, { count: number; resetTime: number }>()

const REDIS_PREFIX = 'ratelimit:'

/**
 * Rate limiting middleware con Redis
 * Returns null if request is allowed, or a NextResponse with 429 status if rate limited
 */
export async function rateLimit(
    request: NextRequest,
    config: RateLimitConfig = DEFAULT_CONFIG
): Promise<NextResponse | null> {
    const identifier = await getIdentifier(request)
    const now = Date.now()
    const redis = getRedisClient()

    let entry: { count: number; resetTime: number } | null = null

    // Intentar usar Redis primero
    if (redis) {
        try {
            const key = `${REDIS_PREFIX}${identifier}`
            const data = await redis.get(key)

            if (data) {
                entry = JSON.parse(data)
            }

            // Si no existe o expiró, crear nueva entrada
            if (!entry || (entry && now > entry.resetTime)) {
                entry = {
                    count: 1,
                    resetTime: now + config.interval
                }

                const ttl = Math.ceil(config.interval / 1000)
                await redis.set(key, JSON.stringify(entry), 'EX', ttl)
            } else {
                // Incrementar contador
                entry.count++
                const ttl = Math.ceil((entry.resetTime - now) / 1000)
                await redis.set(key, JSON.stringify(entry), 'EX', ttl)
            }
        } catch (error) {
            console.error('Error en Redis rate limit, usando fallback en memoria:', error)
            // Continuar con fallback en memoria
            entry = null
        }
    }

    // Fallback: usar memoria si Redis falló o no está disponible
    if (!redis || entry === null) {
        entry = rateLimitStoreMemory.get(identifier) || null

        if (!entry || now > entry.resetTime) {
            entry = {
                count: 1,
                resetTime: now + config.interval
            }
            rateLimitStoreMemory.set(identifier, entry)
        } else {
            entry.count++
            rateLimitStoreMemory.set(identifier, entry)
        }
    }

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

    // Request is allowed - agregar headers informativos
    const remaining = config.maxRequests - entry.count
    // No podemos modificar headers de request, solo en response
    // Esto se haría en el NextResponse del handler

    return null
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

/**
 * Cleanup old entries (solo para fallback en memoria, Redis tiene TTL automático)
 */
export function cleanupRateLimitStore(): void {
    const redis = getRedisClient()

    // Si Redis está disponible, no necesitamos limpiar memoria
    if (redis) return

    const now = Date.now()
    for (const [key, entry] of rateLimitStoreMemory.entries()) {
        if (now > entry.resetTime) {
            rateLimitStoreMemory.delete(key)
        }
    }
}

// Cleanup every 5 minutes (solo para fallback)
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}

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
