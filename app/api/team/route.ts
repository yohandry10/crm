import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId, role } = await getAuthenticatedContext()

    // Get team members (sin join con profiles)
    const { data: members, error: membersError } = await supabase
      .from("organization_members")
      .select("id, user_id, role, is_active, created_at")
      .eq("organization_id", organizationId)
      .order("created_at")

    if (membersError) throw membersError

    // Enriquecer con datos de profiles
    let enrichedMembers: any[] = []
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id)

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", userIds)

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || [])

      enrichedMembers = members.map(m => ({
        ...m,
        profiles: profilesMap.get(m.user_id) || null
      }))
    }

    // Get pending invitations (only for owner/admin)
    let invitations: any[] = []
    if (["owner", "admin"].includes(role)) {
      const { data: invs } = await supabase
        .from("organization_invitations")
        .select("id, email, role, created_at, accepted_at")
        .eq("organization_id", organizationId)
        .is("accepted_at", null)
        .order("created_at", { ascending: false })

      invitations = invs || []
    }

    return NextResponse.json({
      success: true,
      data: {
        members: enrichedMembers,
        invitations,
        currentUserRole: role,
      },
    })
  } catch (error: any) {
    console.error("Team API error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

