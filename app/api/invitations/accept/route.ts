import { NextResponse } from "next/server"
import { createSupabaseRouteHandler } from "@/lib/supabase-server"

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseRouteHandler()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const token = body?.token
    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    const { data, error } = await supabase.rpc("accept_organization_invitation", { p_token: token })
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!data?.success) {
      return NextResponse.json({ error: data?.error || "Failed to accept invitation" }, { status: 400 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}

