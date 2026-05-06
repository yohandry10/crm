import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"

const notificationsQuerySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const markNotificationsSchema = z.object({
  notificationIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  markAllRead: z.boolean().optional().default(false),
  source: z.enum(["notifications", "system_notifications"]).optional(),
}).superRefine((payload, ctx) => {
  if (!payload.markAllRead && (!payload.notificationIds || payload.notificationIds.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Se requieren IDs de notificación o markAllRead",
      path: ["notificationIds"],
    })
  }
})

// GET - Get user notifications (from both tables)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()

    const searchParams = request.nextUrl.searchParams
    const validation = notificationsQuerySchema.safeParse({
      unread: searchParams.get("unread") || undefined,
      limit: searchParams.get("limit") || undefined,
    })

    if (!validation.success) {
      throw new ValidationError("Filtros inválidos", validation.error.format())
    }

    const unreadOnly = validation.data.unread === "true"
    const limit = validation.data.limit

    // Query from notifications table (used by events)
    let notificationsQuery = supabase
      .from("notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      notificationsQuery = notificationsQuery.eq("is_read", false)
    }

    const notificationsPromise = notificationsQuery

    // Also query system_notifications for backwards compatibility
    let systemQuery = supabase
      .from("system_notifications")
      .select("*")
      .eq("organization_id", organizationId)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (unreadOnly) {
      systemQuery = systemQuery.is("read_at", null)
    }

    const systemPromise = systemQuery

    // Count unread from both tables
    const unreadNotifPromise = supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_read", false)

    const unreadSystemPromise = supabase
      .from("system_notifications")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .is("read_at", null)

    const [
      { data: notifications },
      { data: systemNotifications },
      { count: unreadNotif },
      { count: unreadSystem },
    ] = await Promise.all([
      notificationsPromise,
      systemPromise,
      unreadNotifPromise,
      unreadSystemPromise,
    ])

    // Combine and normalize both sources
    const normalizedNotifications = (notifications || []).map(n => ({
      ...n,
      read_at: n.is_read ? n.read_at || n.created_at : null,
      source: 'notifications'
    }))

    const normalizedSystem = (systemNotifications || []).map(n => ({
      ...n,
      is_read: !!n.read_at,
      source: 'system_notifications'
    }))

    // Merge and sort by created_at
    const allNotifications = [...normalizedNotifications, ...normalizedSystem]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)

    return NextResponse.json({
      success: true,
      data: allNotifications,
      unreadCount: (unreadNotif || 0) + (unreadSystem || 0),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// PUT - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const body = await request.json()

    const validation = markNotificationsSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError("Datos inválidos", validation.error.format())
    }

    const { notificationIds, markAllRead, source } = validation.data
    const readAt = new Date().toISOString()

    if (markAllRead) {
      // Mark all as read in both tables
      const notificationsUpdate = await supabase
        .from("notifications")
        .update({ is_read: true, read_at: readAt })
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("is_read", false)
      if (notificationsUpdate.error) throw notificationsUpdate.error

      const systemUpdate = await supabase
        .from("system_notifications")
        .update({ read_at: readAt })
        .eq("organization_id", organizationId)
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .is("read_at", null)
      if (systemUpdate.error) throw systemUpdate.error

    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      if (source === 'notifications' || !source) {
        const notificationsUpdate = await supabase
          .from("notifications")
          .update({ is_read: true, read_at: readAt })
          .in("id", notificationIds)
          .eq("organization_id", organizationId)
          .eq("user_id", user.id)
        if (notificationsUpdate.error) throw notificationsUpdate.error
      }

      if (source === 'system_notifications' || !source) {
        const systemUpdate = await supabase
          .from("system_notifications")
          .update({ read_at: readAt })
          .in("id", notificationIds)
          .eq("organization_id", organizationId)
          .or(`user_id.eq.${user.id},user_id.is.null`)
        if (systemUpdate.error) throw systemUpdate.error
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
