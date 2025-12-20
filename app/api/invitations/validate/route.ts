import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const token = body?.token
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, serviceKey)
    const { data, error } = await supabase
      .from("organization_invitations")
      .select("id, email, role, organization_id, status, expires_at, accepted_at, organizations(name)")
      .eq("token", token)
      .eq("status", "pending")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Invitation invalid or expired" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
