import { NextRequest, NextResponse } from "next/server"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { requirePlatformAdmin, maskRUC, validatePagination } from "@/lib/auth-helpers"
import { logAdminAction, logSensitiveDataAccess } from "@/lib/audit-logger"
import { createRequestLogger } from "@/lib/logger"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { z } from "zod"

const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug inválido").max(80),
  ruc: z.string().trim().regex(/^\d{11}$/, "RUC inválido").optional().nullable().or(z.literal("")),
  ownerEmail: z.string().trim().toLowerCase().email("Email del owner inválido"),
  trialDays: z.number().int().min(1).max(30).default(2),
})

// GET - List all organizations
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
    const { searchParams } = new URL(request.url)

    // Validar paginación (obligatoria)
    const { page, limit, offset } = validatePagination(searchParams)

    // Filtros opcionales
    const search = searchParams.get('search') || ''
    const subscriptionStatus = searchParams.get('subscription_status') || ''
    const subscriptionPlan = searchParams.get('subscription_plan') || ''

    const supabaseAdmin = createSupabaseServiceClient()

    // Construir query
    let query = supabaseAdmin
      .from("organizations")
      .select(
        `id, name, slug, ruc, subscription_status, subscription_plan,
        trial_ends_at, subscription_ends_at, onboarding_completed, created_at`,
        { count: 'exact' }
      )

    // Aplicar filtros
    if (search) {
      query = query.or(`name.ilike.%${search}%,slug.ilike.%${search}%`)
    }

    if (subscriptionStatus) {
      query = query.eq('subscription_status', subscriptionStatus)
    }

    if (subscriptionPlan) {
      query = query.eq('subscription_plan', subscriptionPlan)
    }

    // Orden y paginación
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: organizations, error, count } = await query

    if (error) throw error

    // Enmascarar RUCs y remover datos sensibles
    const safeOrganizations = (organizations || []).map(org => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      ruc: maskRUC(org.ruc),
      subscription_status: org.subscription_status,
      subscription_plan: org.subscription_plan,
      trial_ends_at: org.trial_ends_at,
      subscription_ends_at: org.subscription_ends_at,
      onboarding_completed: org.onboarding_completed,
      created_at: org.created_at,
      // Campos heredados de pasarelas externas no se exponen.
    }))

    // Auditar acceso a datos sensibles
    await logSensitiveDataAccess({
      supabase,
      request,
      userId: user.id,
      dataType: 'organizations',
      recordCount: safeOrganizations.length,
      filters: {
        search,
        subscription_status: subscriptionStatus,
        subscription_plan: subscriptionPlan,
        page,
        limit,
      },
    })

    return NextResponse.json({
      success: true,
      data: safeOrganizations,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    log.error("GET /api/admin/organizations error", error)
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
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
    const parsed = createOrganizationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { name, slug, ruc, ownerEmail, trialDays } = parsed.data

    const supabaseAdmin = createSupabaseServiceClient()

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

    // Auditar creación
    await logAdminAction({
      supabase,
      request,
      userId: user.id,
      action: 'CREATE_ORGANIZATION',
      resource: 'organizations',
      resourceId: result.organization_id,
      details: {
        name,
        slug,
        ownerEmail,
        hasRuc: !!ruc,
        trialDays,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        organizationId: result.organization_id,
        invitationToken: result.invitation_token,
      },
    })
  } catch (error: any) {
    log.error("Error creating organization", error)

    // Auditar fallo
    try {
      const { supabase, user } = await requirePlatformAdmin()
      await logAdminAction({
        supabase,
        request,
        userId: user.id,
        action: 'CREATE_ORGANIZATION',
        resource: 'organizations',
        details: { error: error.message },
        success: false,
      })
    } catch {
      // Ignorar errores de auditoría
    }

    const status =
      error.message === "Unauthorized"
        ? 401
        : error.message.includes("Forbidden")
          ? 403
          : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
