import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import crypto from "crypto"

/**
 * Cron endpoint to cleanup old analytics cache
 * DELETE entries older than 7 days
 * 
 * Resolves: Analytics cache TTL cleanup
 */
import { withRateLimit } from "@/lib/rate-limit"

async function handler(request: NextRequest) {
    try {
        // Verify cron secret
        const authHeader = request.headers.get("authorization")
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
        }

        const supabase = await createSupabaseRouteClient()

        // Call cleanup function
        const { data, error } = await supabase.rpc("cleanup_analytics_cache")

        if (error) throw error

        return NextResponse.json({
            success: true,
            deleted_count: data || 0,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/cron/cleanup-cache",
            method: "GET",
            error,
        })
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

export const GET = withRateLimit(handler, { interval: 60 * 1000, maxRequests: 5 })

export async function POST(request: NextRequest) {
    return GET(request)
}
