import { NextRequest, NextResponse } from "next/server"
import { processWebhookEvents } from "@/lib/events"
import { createRequestLogger } from "@/lib/logger"
import crypto from "crypto"
import { getRedisClient } from "@/lib/redis"
import { validateCronSecret } from "@/lib/cron-auth"

/**
 * Cron job endpoint to process pending webhook events
 * Configure in vercel.json or call via external cron service
 */
export async function GET(request: NextRequest) {
    const log = createRequestLogger(request)
    try {
        const authResponse = validateCronSecret(request)
        if (authResponse) return authResponse

        // Avoid concurrent processors (cron + realtime kicks).
        const redis = getRedisClient()
        const lockKey = "cron:process-events:lock"
        const lockValue = crypto.randomUUID()
        const lockTtlMs = 55_000

        if (redis) {
            const acquired = await redis.set(lockKey, lockValue, "PX", lockTtlMs, "NX")
            if (!acquired) {
                return NextResponse.json({
                    success: true,
                    skipped: true,
                    reason: "Already running",
                    timestamp: new Date().toISOString(),
                })
            }
        }

        await processWebhookEvents()

        // Release lock (best-effort).
        if (redis) {
            try {
                const current = await redis.get(lockKey)
                if (current === lockValue) {
                    await redis.del(lockKey)
                }
            } catch {
                // ignore
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Events processed successfully',
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        log.error('Event processor error', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

// Also allow POST for manual triggers
export async function POST(request: NextRequest) {
    return GET(request)
}
