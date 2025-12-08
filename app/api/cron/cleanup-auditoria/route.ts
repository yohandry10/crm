import { NextResponse } from "next/server"
import { createSupabaseRouteClient } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import crypto from "crypto"

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createSupabaseRouteClient()
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
