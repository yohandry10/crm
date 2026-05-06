import { type NextRequest, NextResponse } from "next/server"
import { GET as cleanupAnalyticsCache } from "../cleanup-analytics-cache/route"
import { GET as cleanupAuditoria } from "../cleanup-auditoria/route"
import { GET as expireQuotes } from "../expire-quotes/route"
import { GET as processEvents } from "../process-events/route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

type CronStep = {
  name: string
  run: (request: NextRequest) => Promise<Response>
}

async function readResponseBody(response: Response) {
  try {
    return await response.json()
  } catch {
    return { message: await response.text() }
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const steps: CronStep[] = [
    { name: "process-events", run: processEvents },
    { name: "expire-quotes", run: expireQuotes },
    { name: "cleanup-analytics-cache", run: cleanupAnalyticsCache },
    { name: "cleanup-auditoria", run: cleanupAuditoria },
  ]

  const results = []

  for (const step of steps) {
    try {
      const response = await step.run(request)
      results.push({
        name: step.name,
        ok: response.ok,
        status: response.status,
        body: await readResponseBody(response),
      })
    } catch (error: any) {
      results.push({
        name: step.name,
        ok: false,
        status: 500,
        body: { error: error?.message || "Cron step failed" },
      })
    }
  }

  const failed = results.filter((result) => !result.ok)

  return NextResponse.json(
    {
      success: failed.length === 0,
      duration_ms: Date.now() - startedAt,
      steps: results,
    },
    { status: failed.length === 0 ? 200 : 500 }
  )
}

export async function POST(request: NextRequest) {
  return GET(request)
}
