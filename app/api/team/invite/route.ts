import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { sendEmail, invitationEmailTemplate, isEmailConfigured } from "@/lib/email"
import { createClient } from "@supabase/supabase-js"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
    if (rateLimitResponse) return rateLimitResponse

    const { user, organizationId, organization, role } = await getAuthenticatedContext()

    // Only owner/admin can invite
    if (!["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para invitar miembros" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role: inviteRole } = body

    if (!email || !inviteRole) {
      return NextResponse.json(
        { success: false, error: "Email y rol son requeridos" },
        { status: 400 }
      )
    }

    // Can't invite as owner
    if (inviteRole === "owner") {
      return NextResponse.json(
        { success: false, error: "No puedes invitar como owner" },
        { status: 400 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if already a member
    const { data: existingMember } = await supabaseAdmin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", (
        await supabaseAdmin.from("profiles").select("id").eq("email", email).single()
      ).data?.id)
      .single()

    if (existingMember) {
      return NextResponse.json(
        { success: false, error: "Este usuario ya es miembro de la organización" },
        { status: 400 }
      )
    }

    // Check if already invited
    const { data: existingInvite } = await supabaseAdmin
      .from("organization_invitations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("email", email)
      .is("accepted_at", null)
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { success: false, error: "Ya existe una invitación pendiente para este email" },
        { status: 400 }
      )
    }

    // Create invitation
    const token = crypto.randomUUID().replace(/-/g, "")
    
    const { error: inviteError } = await supabaseAdmin
      .from("organization_invitations")
      .insert({
        organization_id: organizationId,
        email,
        role: inviteRole,
        token,
        invited_by: user.id,
      })

    if (inviteError) throw inviteError

    // Send email
    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/signup?token=${token}`
    
    let emailSent = false
    if (isEmailConfigured()) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single()

      const result = await sendEmail({
        to: email,
        subject: `Invitación a ${organization.name}`,
        html: invitationEmailTemplate({
          organizationName: organization.name,
          inviterName: profile?.full_name || undefined,
          role: inviteRole,
          inviteLink,
        }),
      })
      emailSent = result.success
    }

    return NextResponse.json({
      success: true,
      message: emailSent ? "Invitación enviada por email" : "Invitación creada",
      data: { inviteLink, emailSent },
    })
  } catch (error: any) {
    console.error("Invite error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
