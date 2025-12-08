import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteHandler } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://crqnkdpjxeoqkfpttncq.supabase.co"
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycW5rZHBqeGVvcWtmcHR0bmNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzcwMzE3MiwiZXhwIjoyMDc5Mjc5MTcyfQ.iE4sjwPky0u_NN7_krMOogGPrGUbtN_JhhIqEGmwvTo"

async function requirePlatformAdmin() {
  const supabase = await createSupabaseRouteHandler()

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_platform_admin) {
    throw new Error("Forbidden: Platform admin required")
  }

  return { supabase, user }
}

function getAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const supabaseAdmin = getAdminClient()

    // Get organization
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("*")
      .eq("id", id)
      .single()

    if (orgError) throw orgError

    // Get members
    const { data: members } = await supabaseAdmin
      .from("organization_members")
      .select(`
        id, user_id, role, created_at,
        profiles(email, full_name)
      `)
      .eq("organization_id", id)
      .eq("is_active", true)

    // Get subscription history
    const { data: subscriptionHistory } = await supabaseAdmin
      .from("subscription_history")
      .select("*")
      .eq("organization_id", id)
      .order("started_at", { ascending: false })

    return NextResponse.json({
      success: true,
      data: {
        organization,
        members: members || [],
        subscriptionHistory: subscriptionHistory || [],
      },
    })
  } catch (error: any) {
    console.error("GET /api/admin/organizations/[id] error:", error)
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const supabaseAdmin = getAdminClient()

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update({
        name: body.name,
        ruc: body.ruc,
        max_users: body.max_users,
        max_contacts: body.max_contacts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("PUT /api/admin/organizations/[id] error:", error)
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
