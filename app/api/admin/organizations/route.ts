import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteHandler } from "@/lib/supabase-server"
import { createClient } from "@supabase/supabase-js"

async function requirePlatformAdmin() {
  const supabase = await createSupabaseRouteHandler()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
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
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials")
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

// GET - List all organizations
export async function GET() {
  try {
    await requirePlatformAdmin()

    const supabaseAdmin = getAdminClient()

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .select(
        `id, name, slug, ruc, subscription_status, subscription_plan,
        trial_ends_at, subscription_ends_at, onboarding_completed, created_at`
      )
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    console.error("GET /api/admin/organizations error:", error)
    const status =
      error.message === "Unauthorized"
        ? 401
        : error.message.includes("Forbidden")
          ? 403
          : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}

// POST - Create new organization with trial
export async function POST(request: NextRequest) {
  try {
    const { user } = await requirePlatformAdmin()
    const body = await request.json()

    const { name, slug, ruc, ownerEmail, trialDays = 2 } = body

    if (!name || !ownerEmail) {
      return NextResponse.json(
        { success: false, error: "Nombre y email del owner son requeridos" },
        { status: 400 }
      )
    }

    const supabaseAdmin = getAdminClient()

    // Check if slug already exists
    const { data: existing } = await supabaseAdmin
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .single()

    if (existing) {
      return NextResponse.json(
        { success: false, error: "El slug ya está en uso" },
        { status: 400 }
      )
    }

    // Call the function to create org with trial
    const { data, error } = await supabaseAdmin.rpc("create_organization_with_trial", {
      p_name: name,
      p_slug: slug,
      p_owner_email: ownerEmail,
      p_ruc: ruc || null,
      p_created_by: user.id,
      p_trial_days: trialDays,
    })

    if (error) throw error

    const result = data?.[0]
    if (!result) {
      throw new Error("Error al crear organización")
    }

    return NextResponse.json({
      success: true,
      data: {
        organizationId: result.organization_id,
        invitationToken: result.invitation_token,
      },
    })
  } catch (error: any) {
    console.error("Error creating organization:", error)
    const status =
      error.message === "Unauthorized"
        ? 401
        : error.message.includes("Forbidden")
          ? 403
          : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
