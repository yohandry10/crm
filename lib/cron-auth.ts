import { NextResponse } from "next/server"

export function validateCronSecret(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: "Cron secret not configured" },
      { status: 500 }
    )
  }

  const provided = request.headers.get("x-cron-secret")
  const authHeader = request.headers.get("authorization")
  const authorized =
    provided === cronSecret ||
    authHeader === `Bearer ${cronSecret}`

  if (!authorized) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  return null
}
