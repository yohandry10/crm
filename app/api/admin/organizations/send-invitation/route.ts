import { NextRequest, NextResponse } from "next/server"
import { createAuthenticatedClient } from "@/lib/supabase-auth"
import { sendEmail, invitationEmailTemplate, isEmailConfigured } from "@/lib/email"

async function requirePlatformAdmin() {
  const { supabase } = await createAuthenticatedClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin, full_name")
    .eq("id", user.id)
    .single()

  if (!profile?.is_platform_admin) {
    throw new Error("Forbidden: Platform admin required")
  }

  return { supabase, user, adminName: profile.full_name }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, adminName } = await requirePlatformAdmin()
    const body = await request.json()

    const { organizationId, email, token } = body

    if (!organizationId || !email || !token) {
      return NextResponse.json(
        { success: false, error: "Datos incompletos" },
        { status: 400 }
      )
    }

    // Get organization name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organizationId)
      .single()

    // Get invitation role
    const { data: invitation } = await supabase
      .from("organization_invitations")
      .select("role")
      .eq("token", token)
      .single()

    const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/signup?token=${token}`

    // Send email if configured
    let emailSent = false
    if (isEmailConfigured()) {
      const result = await sendEmail({
        to: email,
        subject: `Invitación a ${org?.name || "CRM"}`,
        html: invitationEmailTemplate({
          organizationName: org?.name || "CRM",
          inviterName: adminName || undefined,
          role: invitation?.role || "usuario",
          inviteLink,
        }),
      })
      emailSent = result.success
    }

    console.log(`Invitation ${emailSent ? "sent" : "generated"} for ${email}: ${inviteLink}`)

    return NextResponse.json({
      success: true,
      message: emailSent ? "Invitación enviada por email" : "Link de invitación generado",
      data: { inviteLink, emailSent },
    })
  } catch (error: any) {
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
