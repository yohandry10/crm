import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { requirePlatformAdmin, maskEmail, maskRUC } from "@/lib/auth-helpers"
import { logAdminAction, logSensitiveDataAccess } from "@/lib/audit-logger"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"
import { z } from "zod"

const organizationIdSchema = z.string().uuid("Organization ID inválido")
const organizationPatchSchema = z.object({
  action: z.enum(["deactivate", "activate"]),
  subscription_status: z.enum(["trial", "active", "past_due", "cancelled", "expired"]).optional(),
})
const organizationUpdateSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  ruc: z.string().trim().regex(/^\d{11}$/, "RUC inválido").optional().nullable().or(z.literal("")),
  max_users: z.number().int().min(1).max(1000),
  max_contacts: z.number().int().min(-1).max(1000000),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
    const { id: rawId } = await params
    const idResult = organizationIdSchema.safeParse(rawId)
    if (!idResult.success) {
      return NextResponse.json({ success: false, error: "Organization ID inválido" }, { status: 400 })
    }
    const id = idResult.data
    const supabaseAdmin = createSupabaseServiceClient()

    // Get organization
    const { data: organization, error: orgError } = await supabaseAdmin
      .from("organizations")
      .select("id, name, slug, ruc, is_active, subscription_status, subscription_plan, trial_ends_at, subscription_ends_at, onboarding_completed, created_at, max_users, max_contacts")
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
    const { id: rawId } = await params
    const idResult = organizationIdSchema.safeParse(rawId)
    if (!idResult.success) {
      return NextResponse.json({ success: false, error: "Organization ID inválido" }, { status: 400 })
    }
    const id = idResult.data
    const parsed = organizationPatchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { action, subscription_status } = parsed.data
    const supabaseAdmin = createSupabaseServiceClient()

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    }

    if (action === "deactivate") {
      updates.is_active = false
      updates.subscription_status = "cancelled"
    } else if (action === "activate") {
      updates.is_active = true
      if (subscription_status) {
        updates.subscription_status = subscription_status
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
    const { id: rawId } = await params
    const idResult = organizationIdSchema.safeParse(rawId)
    if (!idResult.success) {
      return NextResponse.json({ success: false, error: "Organization ID inválido" }, { status: 400 })
    }
    const id = idResult.data
    const parsed = organizationUpdateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const body = parsed.data
    const supabaseAdmin = createSupabaseServiceClient()

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
        ruc: body.ruc || null,
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
