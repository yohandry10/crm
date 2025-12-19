import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { requirePlatformAdmin, maskEmail, maskRUC } from "@/lib/auth-helpers"
import { logAdminAction, logSensitiveDataAccess } from "@/lib/audit-logger"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"

function getAdminClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Missing Supabase service credentials")
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
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

    // Enmascarar datos sensibles
    const safeOrganization = {
      ...organization,
      ruc: maskRUC(organization.ruc),
      // Remover stripe_customer_id si existe
      stripe_customer_id: undefined,
    }

    const safeMembers = (members || []).map((m: any) => ({
      ...m,
      profiles: {
        ...m.profiles,
        email: maskEmail(m.profiles?.email),
      },
    }))

    // Auditar acceso
    await logSensitiveDataAccess({
      supabase,
      request,
      userId: user.id,
      dataType: 'organization_detail',
      recordCount: 1,
      filters: { organizationId: id },
    })

    return NextResponse.json({
      success: true,
      data: {
        organization: safeOrganization,
        members: safeMembers,
        subscriptionHistory: subscriptionHistory || [],
      },
    })
  } catch (error: any) {
    log.error("GET /api/admin/organizations/[id] error", error)
    const status = error.message === "Unauthorized" ? 401 :
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const action = body?.action as "deactivate" | "activate"

    if (!action) {
      return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 })
    }

    const supabaseAdmin = getAdminClient()

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (action === "deactivate") {
      updates.is_active = false
      updates.subscription_status = "cancelled"
    } else if (action === "activate") {
      updates.is_active = true
      if (body?.subscription_status) {
        updates.subscription_status = body.subscription_status
      } else {
        updates.subscription_status = "trial"
      }
    }

    const { data, error } = await supabaseAdmin
      .from("organizations")
      .update(updates)
      .eq("id", id)
      .select("id, name, is_active, subscription_status")
      .single()

    if (error) throw error

    await logAdminAction({
      supabase,
      request,
      userId: user.id,
      action: action === "deactivate" ? "SUSPEND_ORGANIZATION" : "ACTIVATE_ORGANIZATION",
      resource: "organizations",
      resourceId: id,
      details: { updates },
      success: true,
    })

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    log.error("PATCH /api/admin/organizations/[id] error", error)
    const status = error.message === "Unauthorized" ? 401 :
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
    const { id } = await params
    const body = await request.json()
    const supabaseAdmin = getAdminClient()

    // Obtener datos anteriores para auditoría
    const { data: oldData } = await supabaseAdmin
      .from("organizations")
      .select("name, ruc, max_users, max_contacts")
      .eq("id", id)
      .single()

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

    // Auditar actualización
    await logAdminAction({
      supabase,
      request,
      userId: user.id,
      action: 'UPDATE_ORGANIZATION',
      resource: 'organizations',
      resourceId: id,
      details: {
        changes: {
          name: { old: oldData?.name, new: body.name },
          ruc: { old: maskRUC(oldData?.ruc), new: maskRUC(body.ruc) },
          max_users: { old: oldData?.max_users, new: body.max_users },
          max_contacts: { old: oldData?.max_contacts, new: body.max_contacts },
        },
      },
      success: true,
    })

    // Enmascarar RUC en la respuesta
    const safeData = {
      ...data,
      ruc: maskRUC(data.ruc),
    }

    return NextResponse.json({ success: true, data: safeData })
  } catch (error: any) {
    log.error("PUT /api/admin/organizations/[id] error", error)
    const status = error.message === "Unauthorized" ? 401 :
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
