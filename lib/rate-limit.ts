import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface RateLimitConfig {
    interval: number // milliseconds
    maxRequests: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
    interval: 60 * 1000, // 1 minute
    maxRequests: 100
}

// In-memory store for development
// For production, use Redis or Supabase Edge Functions KV
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Rate limiting middleware
 * Returns null if request is allowed, or a NextResponse with 429 status if rate limited
 */
export async function rateLimit(
    request: NextRequest,
    config: RateLimitConfig = DEFAULT_CONFIG
): Promise<NextResponse | null> {
    const identifier = await getIdentifier(request)
    const now = Date.now()

    // Get or create rate limit entry
    let entry = rateLimitStore.get(identifier)

    if (!entry || now > entry.resetTime) {
        // Create new entry or reset
        entry = {
            count: 0,
            resetTime: now + config.interval
        }
        rateLimitStore.set(identifier, entry)
    }

    entry.count++

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
 * Cleanup old entries (should be called periodically)
 */
export function cleanupRateLimitStore(): void {
    const now = Date.now()
    for (const [key, entry] of rateLimitStore.entries()) {
        if (now > entry.resetTime) {
            rateLimitStore.delete(key)
        }
    }
}

// Cleanup every 5 minutes
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
