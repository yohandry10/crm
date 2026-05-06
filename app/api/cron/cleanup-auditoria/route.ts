import { NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logError } from "@/lib/error-logging"
import { validateCronSecret } from "@/lib/cron-auth"
import crypto from "crypto"

export async function GET(request: Request) {
  try {
    const authResponse = validateCronSecret(request)
    if (authResponse) return authResponse

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase.rpc("cleanup_auditoria", { p_days: 90 })
    if (error) throw error

    return NextResponse.json({ success: true, deleted: data ?? 0, ran_at: new Date().toISOString() })
  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/cron/cleanup-auditoria",
      method: "GET",
      error,
    })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
