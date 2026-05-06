import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth-helpers"

export async function GET() {
  try {
    const { supabase } = await requirePlatformAdmin()

    const { data, error } = await supabase
      .from("subscription_history")
      .select(`
        id, plan, status, amount, billing_period, started_at, ended_at,
        organization_id,
        organizations!inner(name)
      `)
      .order("started_at", { ascending: false })

    if (error) throw error

    const formatted = data?.map(s => ({
      ...s,
      organization_name: (s.organizations as any)?.name,
    })) || []

    return NextResponse.json({ success: true, data: formatted })
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
