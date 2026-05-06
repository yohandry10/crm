import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"

const clientErrorSchema = z.object({
  errorId: z.string().min(8).max(120).optional(),
  source: z.enum([
    "react-boundary",
    "app-error",
    "global-error",
    "window-error",
    "unhandled-rejection",
    "swr",
  ]),
  message: z.string().min(1).max(500),
  stack: z.string().max(5000).optional(),
  componentStack: z.string().max(5000).optional(),
  digest: z.string().max(200).optional(),
  path: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, RATE_LIMITS.write)
  if (limited) return limited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Payload inválido" }, { status: 400 })
  }

  const parsed = clientErrorSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Payload inválido" }, { status: 400 })
  }

  const errorId = await logError({
    errorId: parsed.data.errorId,
    endpoint: parsed.data.path || request.nextUrl.pathname,
    method: "CLIENT",
    error: {
      name: "ClientError",
      message: parsed.data.message,
      stack: parsed.data.stack,
      componentStack: parsed.data.componentStack,
      digest: parsed.data.digest,
      source: parsed.data.source,
      userAgent: parsed.data.userAgent,
    },
  })

  return NextResponse.json({ success: true, errorId })
}
