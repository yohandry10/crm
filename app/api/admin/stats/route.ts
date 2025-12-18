import { NextRequest, NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth-helpers"
import { logSensitiveDataAccess } from "@/lib/audit-logger"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user } = await requirePlatformAdmin()

    // Get organization counts by status
    const { data: orgs } = await supabase
      .from("organizations")
      .select("id, subscription_status")

    const totalOrganizations = orgs?.length || 0
    const activeOrganizations = orgs?.filter(o => o.subscription_status === "active").length || 0
    const trialOrganizations = orgs?.filter(o => o.subscription_status === "trial").length || 0
    const expiredOrganizations = orgs?.filter(o =>
      o.subscription_status === "expired" || o.subscription_status === "cancelled"
    ).length || 0

    // Get total users
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })

    // Get monthly revenue (from subscription_history this month)
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const { data: subscriptions } = await supabase
      .from("subscription_history")
      .select("amount")
      .gte("started_at", startOfMonth.toISOString())
      .eq("status", "active")

    const monthlyRevenue = subscriptions?.reduce((sum, s) => sum + (s.amount || 0), 0) || 0

    // Get recent organizations (sin datos sensibles)
    const { data: recentOrganizations } = await supabase
      .from("organizations")
      .select("id, name, slug, subscription_status, subscription_plan, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

    // Auditar acceso
    await logSensitiveDataAccess({
      supabase,
      request,
      userId: user.id,
      dataType: 'admin_stats',
      recordCount: totalOrganizations,
      filters: {},
    })

    return NextResponse.json({
      success: true,
      data: {
        totalOrganizations,
        activeOrganizations,
        trialOrganizations,
        expiredOrganizations,
        totalUsers: totalUsers || 0,
        monthlyRevenue,
        recentOrganizations: recentOrganizations || [],
      },
    })
  } catch (error: any) {
    log.error("GET /api/admin/stats error", error)
    const status = error.message === "Unauthorized" ? 401 :
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
