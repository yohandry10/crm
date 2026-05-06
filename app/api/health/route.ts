import { NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/lib/supabase-auth"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { isRedisHealthy } from "@/lib/redis"

/**
 * Health check endpoint
 * ⚠️ Este endpoint es público para monitoreo externo
 * NO expone información sensible, solo estado de servicios
 */
export async function GET() {
    const health = {
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || "0.1.0",
        services: {} as Record<string, { status: string; response_time_ms: number }>
    }

    try {
        // Check database - solo verificar conexión, no exponer errores
        const dbStart = Date.now()
        const serviceSupabase = createSupabaseServiceClient()
        const { error: dbError } = await serviceSupabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .limit(1)
        const dbTime = Date.now() - dbStart

        health.services.database = {
            status: dbError ? "down" : "healthy",
            response_time_ms: dbTime
            // ❌ NO exponer error.message - puede contener info sensible
        }

        // Check auth service
        const authStart = Date.now()
        const supabase = await createSupabaseRouteClient()
        const { error: authError } = await supabase.auth.getSession()
        const authTime = Date.now() - authStart

        health.services.auth = {
            status: authError ? "down" : "healthy",
            response_time_ms: authTime
        }

        // Check redis service (rate limiting / cache)
        const redisStart = Date.now()
        const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST)
        const failOpen = process.env.RATE_LIMIT_FAIL_OPEN === "true"

        let redisStatus: string
        if (!redisConfigured) {
            redisStatus = failOpen ? "degraded" : "down"
        } else {
            const redisHealthy = await isRedisHealthy()
            redisStatus = redisHealthy ? "healthy" : (failOpen ? "degraded" : "down")
        }

        health.services.redis = {
            status: redisStatus,
            response_time_ms: Date.now() - redisStart
        }

        // Overall status
        const hasDown = Object.values(health.services).some(s => s.status === "down")
        health.status = hasDown ? "degraded" : "healthy"

        // ❌ REMOVIDO: No escribir a BD sin autenticación
        // Esto era un vector de ataque (spam a la tabla)
        // Si se necesita logging, usar un servicio externo o cron autenticado

        const statusCode = health.status === "healthy" ? 200 : 503

        return NextResponse.json(health, { status: statusCode })

    } catch {
        // No exponer detalles del error en producción
        return NextResponse.json({
            status: "down",
            timestamp: new Date().toISOString()
            // ❌ NO incluir error.message
        }, { status: 503 })
    }
}
