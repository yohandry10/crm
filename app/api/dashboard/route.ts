import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase.rpc("get_dashboard_metrics", {
            p_organization_id: organizationId,
        })

        if (error) throw error

        const dashboardData = data || {
            stats: [],
            activityOverview: [],
            pipeline: [],
            recentInvoices: [],
        }

        const response = NextResponse.json({
            success: true,
            data: dashboardData,
            cachedAt: new Date().toISOString()
        })

        // ✅ SECURITY: Prevent cache leaks between organizations
        // Cache más agresivo: 2 min de cache fresco, 5 min stale permitido
        response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300')

        // Vary header ensures different cache entries for different auth contexts
        response.headers.set('Vary', 'Authorization, Cookie, X-Organization-ID')

        // Unique cache key per organization to prevent cross-org data leaks
        const cacheKey = crypto.createHash('sha256')
            .update(`dashboard:${organizationId}:${new Date().toISOString().slice(0, 10)}`)
            .digest('hex')
        response.headers.set('X-Cache-Key', cacheKey)

        return response
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/dashboard", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
