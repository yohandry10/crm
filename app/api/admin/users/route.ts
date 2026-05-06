import { NextRequest, NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { requirePlatformAdmin, maskEmail, validatePagination } from "@/lib/auth-helpers"
import { logAdminAction, logSensitiveDataAccess } from "@/lib/audit-logger"
import { createRequestLogger } from "@/lib/logger"
import { z } from "zod"

const roleFilterSchema = z.enum(["owner", "admin", "manager", "member", "viewer"]).optional()
const updateUserPermissionsSchema = z.object({
  userId: z.string().uuid("User ID inválido"),
  is_platform_admin: z.boolean(),
})

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
    const roleFilterResult = roleFilterSchema.safeParse(searchParams.get('role') || undefined)
    if (!roleFilterResult.success) {
      return NextResponse.json(
        { success: false, error: "Filtro de rol inválido" },
        { status: 400 }
      )
    }
    const roleFilter = roleFilterResult.data || ''
    const isActiveFilter = searchParams.get('is_active')

    const supabaseAdmin = createSupabaseServiceClient()

    // Construir query
    let query = supabaseAdmin
      .from("profiles")
      .select(`
        id, email, full_name, is_platform_admin, created_at,
        organization_members(
          role,
          is_active,
          organizations(id, name)
        )
      `, { count: 'exact' })

    // Aplicar filtros
    if (search) {
      query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
    }

    if (isActiveFilter !== null) {
      const isActive = isActiveFilter === 'true'
      query = query.eq('organization_members.is_active', isActive)
    }

    // Orden y paginación
    query = query
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: profiles, error, count } = await query

    if (error) throw error

    // Filtrar por rol si es necesario
    let filteredProfiles = profiles || []
    if (roleFilter) {
      filteredProfiles = filteredProfiles.filter(p =>
        (p.organization_members || []).some((m: any) => m.role === roleFilter)
      )
    }

    // Enmascarar emails y procesar datos
    const users = filteredProfiles.map(p => ({
      id: p.id,
      email: maskEmail(p.email),
      full_name: p.full_name,
      is_platform_admin: p.is_platform_admin || false,
      created_at: p.created_at,
      organizations: (p.organization_members || []).map((m: any) => ({
        id: m.organizations?.id,
        name: m.organizations?.name || "Unknown",
        role: m.role,
        is_active: m.is_active,
      })),
    }))

    // Auditar acceso a datos sensibles
    await logSensitiveDataAccess({
      supabase,
      request,
      userId: user.id,
      dataType: 'users',
      recordCount: users.length,
      filters: {
        search,
        role: roleFilter,
        is_active: isActiveFilter,
        page,
        limit,
      },
    })

    return NextResponse.json({
      success: true,
      data: users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    log.error("GET /api/admin/users error", error)

    const status = error.message === "Unauthorized" ? 401 :
                   error.message.includes("Forbidden") ? 403 : 500

    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()
    const parsed = updateUserPermissionsSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { userId, is_platform_admin } = parsed.data
    const supabaseAdmin = createSupabaseServiceClient()

    // Obtener datos anteriores para auditoría
    const { data: oldProfile } = await supabaseAdmin
      .from("profiles")
      .select("is_platform_admin, email")
      .eq("id", userId)
      .single()

    // Actualizar usuario
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_platform_admin })
      .eq("id", userId)

    if (error) throw error

    // Auditar acción
    await logAdminAction({
      supabase,
      request,
      userId: user.id,
      action: 'UPDATE_USER_PERMISSIONS',
      resource: 'profiles',
      resourceId: userId,
      details: {
        targetUser: userId,
        targetEmail: maskEmail(oldProfile?.email),
        oldValue: oldProfile?.is_platform_admin,
        newValue: is_platform_admin,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      message: "Permisos actualizados exitosamente",
    })
  } catch (error: any) {
    log.error("PATCH /api/admin/users error", error)

    const status = error.message === "Unauthorized" ? 401 :
                   error.message.includes("Forbidden") ? 403 : 500

    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
