import { NextResponse } from "next/server"
import { createAuthenticatedClient } from "@/lib/supabase-auth"

async function requirePlatformAdmin() {
  const { supabase } = await createAuthenticatedClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin, role")
    .eq("id", user.id)
    .single()

  const isAdmin = profile?.is_platform_admin || 
                  profile?.role === 'superadmin' || 
                  profile?.role === 'platform_admin'

  if (!isAdmin) {
    throw new Error("Forbidden: Platform admin required")
  }

  return { supabase, user }
}

export async function GET() {
  try {
    const { supabase } = await requirePlatformAdmin()

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

    // Get recent organizations
    const { data: recentOrganizations } = await supabase
      .from("organizations")
      .select("id, name, slug, subscription_status, subscription_plan, created_at")
      .order("created_at", { ascending: false })
      .limit(5)

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
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
