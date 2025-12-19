import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"

// GET - Get user notifications (from both tables)
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()

    const searchParams = request.nextUrl.searchParams
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = parseInt(searchParams.get("limit") || "20")

    // Query from notifications table (used by events)
    let notificationsQuery = supabase
      .from("notifications")
      .select("*")
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
      .or(`user_id.eq.${user.id},organization_id.eq.${organizationId}`)
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
      .eq("user_id", user.id)
      .eq("is_read", false)

    const unreadSystemPromise = supabase
      .from("system_notifications")
      .select("*", { count: "exact", head: true })
      .or(`user_id.eq.${user.id},organization_id.eq.${organizationId}`)
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
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Mark notifications as read
export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await getAuthenticatedContext()
    const body = await request.json()

    const { notificationIds, markAllRead, source } = body

    if (markAllRead) {
      // Mark all as read in both tables
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false)

      await supabase
        .from("system_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("read_at", null)

    } else if (notificationIds && notificationIds.length > 0) {
      // Mark specific notifications as read
      if (source === 'notifications' || !source) {
        await supabase
          .from("notifications")
          .update({ is_read: true, read_at: new Date().toISOString() })
          .in("id", notificationIds)
          .eq("user_id", user.id)
      }

      if (source === 'system_notifications' || !source) {
        await supabase
          .from("system_notifications")
          .update({ read_at: new Date().toISOString() })
          .in("id", notificationIds)
          .eq("user_id", user.id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
