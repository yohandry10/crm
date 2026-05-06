import { type NextRequest, NextResponse } from "next/server"
import { requirePlatformAdmin, validatePagination } from "@/lib/auth-helpers"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { logAuditEvent } from "@/lib/audit"
import crypto from "crypto"

const ALLOWED_CATEGORIES = new Set(["auth", "billing", "data", "admin", "export", "security", "system"])
const ALLOWED_SEVERITIES = new Set(["info", "warn", "error"])

export async function GET(request: NextRequest) {
  try {
    const { user } = await requirePlatformAdmin()
    const supabaseAdmin = createSupabaseServiceClient()
    const searchParams = request.nextUrl.searchParams
    const { page, limit, offset } = validatePagination(searchParams)

    const category = searchParams.get("category")
    const severity = searchParams.get("severity")
    const success = searchParams.get("success")
    const organizationId = searchParams.get("organization_id")
    const userId = searchParams.get("user_id")
    const action = searchParams.get("action")
    const requestId = searchParams.get("request_id")
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    if (category && !ALLOWED_CATEGORIES.has(category)) {
      return NextResponse.json({ success: false, error: "Categoría inválida" }, { status: 400 })
    }

    if (severity && !ALLOWED_SEVERITIES.has(severity)) {
      return NextResponse.json({ success: false, error: "Severidad inválida" }, { status: 400 })
    }

    let query = supabaseAdmin
      .from("auditoria")
      .select("*", { count: "exact" })
      .order("timestamp", { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) query = query.eq("event_category", category)
    if (severity) query = query.eq("severity", severity)
    if (success === "true") query = query.eq("success", true)
    if (success === "false") query = query.eq("success", false)
    if (organizationId) query = query.eq("organization_id", organizationId)
    if (userId) query = query.eq("usuario_id", userId)
    if (action) query = query.ilike("accion", `%${action}%`)
    if (requestId) query = query.eq("request_id", requestId)
    if (from) query = query.gte("timestamp", from)
    if (to) query = query.lte("timestamp", to)

    const { data, error, count } = await query
    if (error) throw error

    const userIds = [...new Set((data || []).map((row: any) => row.usuario_id).filter(Boolean))]
    const orgIds = [...new Set((data || []).map((row: any) => row.organization_id).filter(Boolean))]

    const [{ data: profiles }, { data: organizations }] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("profiles").select("id, email, full_name").in("id", userIds)
        : Promise.resolve({ data: [] }),
      orgIds.length
        ? supabaseAdmin.from("organizations").select("id, name, slug").in("id", orgIds)
        : Promise.resolve({ data: [] }),
    ])

    const profilesById = new Map((profiles || []).map((profile: any) => [profile.id, profile]))
    const organizationsById = new Map((organizations || []).map((org: any) => [org.id, org]))

    await logAuditEvent({
      supabase: supabaseAdmin,
      request,
      userId: user.id,
      action: "ADMIN_VIEW_AUDIT_LOGS",
      category: "admin",
      table: "auditoria",
      metadata: {
        filters: {
          category,
          severity,
          success,
          organization_id: organizationId,
          user_id: userId,
          action,
          request_id: requestId,
          from,
          to,
        },
        result_count: data?.length || 0,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: (data || []).map((row: any) => ({
        ...row,
        user: row.usuario_id ? profilesById.get(row.usuario_id) || null : null,
        organization: row.organization_id ? organizationsById.get(row.organization_id) || null : null,
      })),
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error: any) {
    await logError({ errorId: crypto.randomUUID(), endpoint: "/api/admin/audit-logs", method: "GET", error })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
