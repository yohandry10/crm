/**
 * API Middleware - Funciones comunes para todos los endpoints
 * Incluye rate limiting, autenticación y manejo de errores
 */

import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import crypto from "crypto"

interface ApiHandlerOptions {
    rateLimit?: {
        interval: number
        maxRequests: number
    }
    requireAuth?: boolean
}

type ApiHandler = (
    request: NextRequest,
    context: { supabase: any; user: any; params?: any }
) => Promise<NextResponse>

/**
 * Wrapper para handlers de API con autenticación, rate limiting y manejo de errores
 */
export function withApiMiddleware(
    handler: ApiHandler,
    options: ApiHandlerOptions = {}
) {
    const { rateLimit: rateLimitConfig, requireAuth = true } = options

    return async (request: NextRequest, routeContext?: any) => {
        const endpoint = request.nextUrl.pathname
        const method = request.method

        try {
            // 1. Rate Limiting
            if (rateLimitConfig) {
                const rateLimitResponse = await rateLimit(request, rateLimitConfig)
                if (rateLimitResponse) {
                    return rateLimitResponse
                }
            }

            // 2. Autenticación
            let supabase: any = null
            let user: any = null

            if (requireAuth) {
                const auth = await getAuthenticatedClientAndUser()
                supabase = auth.supabase
                user = auth.user
            }

            // 3. Ejecutar handler
            const params = routeContext?.params ? await routeContext.params : undefined
            return await handler(request, { supabase, user, params })

        } catch (error: any) {
            // Log error
            await logError({
                errorId: crypto.randomUUID(),
                endpoint,
                method,
                error,
                userId: undefined,
                requestBody: ['POST', 'PUT', 'PATCH'].includes(method) 
                    ? await request.clone().json().catch(() => undefined)
                    : undefined
            })

            // Return sanitized error
            return NextResponse.json(
                { success: false, error: sanitizeErrorForClient(error) },
                { status: getHttpStatusForError(error) }
            )
        }
    }
}

/**
 * Configuraciones de rate limit predefinidas
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
}

/**
 * Helper para respuestas exitosas
 */
export function successResponse(data: any, meta?: any) {
    return NextResponse.json({
        success: true,
        data,
        ...meta
    })
}

/**
 * Helper para respuestas paginadas
 */
export function paginatedResponse(
    data: any[],
    pagination: { page: number; limit: number; total: number }
) {
    return NextResponse.json({
        success: true,
        data,
        pagination: {
            ...pagination,
            totalPages: Math.ceil(pagination.total / pagination.limit)
        }
    })
}
