import { NextResponse } from "next/server"
import { createAuthenticatedClient } from "@/lib/supabase-auth"
import { createClient } from "@supabase/supabase-js"

async function requirePlatformAdmin() {
  const { supabase } = await createAuthenticatedClient()
  
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

export async function GET() {
  try {
    await requirePlatformAdmin()

    // Use service role to get all users
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get all profiles with their memberships
    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select(`
        id, email, full_name, is_platform_admin, created_at,
        organization_members(
          role,
          organizations(name)
        )
      `)
      .order("created_at", { ascending: false })

    if (error) throw error

    const users = profiles?.map(p => ({
      id: p.id,
      email: p.email,
      full_name: p.full_name,
      is_platform_admin: p.is_platform_admin || false,
      created_at: p.created_at,
      organizations: (p.organization_members || []).map((m: any) => ({
        name: m.organizations?.name || "Unknown",
        role: m.role,
      })),
    })) || []

    return NextResponse.json({ success: true, data: users })
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
