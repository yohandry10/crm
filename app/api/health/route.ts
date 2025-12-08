import { NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/lib/supabase-auth"

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
        const supabase = await createSupabaseRouteClient()
        const { error: dbError } = await supabase.from("profiles").select("id").limit(1)
        const dbTime = Date.now() - dbStart

        health.services.database = {
            status: dbError ? "down" : "healthy",
            response_time_ms: dbTime
            // ❌ NO exponer error.message - puede contener info sensible
        }

        // Check auth service
        const authStart = Date.now()
        const { error: authError } = await supabase.auth.getSession()
        const authTime = Date.now() - authStart

        health.services.auth = {
            status: authError ? "down" : "healthy",
            response_time_ms: authTime
        }

        // Overall status
        const allHealthy = Object.values(health.services).every(s => s.status === "healthy")
        health.status = allHealthy ? "healthy" : "degraded"

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
