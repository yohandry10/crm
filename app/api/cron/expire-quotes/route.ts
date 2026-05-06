import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logError } from "@/lib/error-logging"
import { validateCronSecret } from "@/lib/cron-auth"
import crypto from "crypto"

/**
 * Cron endpoint to expire old quotes
 * Marks quotes as 'expired' if valid_until has passed
 * 
 * Resolves: ERROR-VOID-006
 */
import { withRateLimit } from "@/lib/rate-limit"

async function handler(request: NextRequest) {
    try {
        const authResponse = validateCronSecret(request)
        if (authResponse) return authResponse

        const supabase = createSupabaseServiceClient()

        // Call expire function
        const { data, error } = await supabase.rpc("expire_old_quotes")

        if (error) throw error

        return NextResponse.json({
            success: true,
            expired_count: data || 0,
            timestamp: new Date().toISOString()
        })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/cron/expire-quotes",
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
