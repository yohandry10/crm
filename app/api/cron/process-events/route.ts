import { NextRequest, NextResponse } from "next/server"
import { processWebhookEvents } from "@/lib/events"

/**
 * Cron job endpoint to process pending webhook events
 * Configure in vercel.json or call via external cron service
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = request.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await processWebhookEvents()

        return NextResponse.json({
            success: true,
            message: 'Events processed successfully',
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Event processor error:', error)
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
