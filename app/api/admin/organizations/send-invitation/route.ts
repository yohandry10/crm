import { NextRequest, NextResponse } from "next/server"
import { sendEmail, invitationEmailTemplate, isEmailConfigured } from "@/lib/email"
import { createRequestLogger } from "@/lib/logger"
import { maskEmail, requirePlatformAdmin } from "@/lib/auth-helpers"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from "zod"

const sendInvitationSchema = z.object({
  organizationId: z.string().uuid("Organization ID invalido"),
  email: z.string().trim().toLowerCase().email("Email invalido"),
  token: z.string().trim().min(16, "Token invalido").max(200, "Token invalido"),
})

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const { supabase, user } = await requirePlatformAdmin()
    const parsed = sendInvitationSchema.safeParse(await request.json())

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos invalidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { organizationId, email, token } = parsed.data

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single()

    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { success: false, error: "Organizacion no encontrada" },
        { status: 404 }
      )
    }

    const { data: invitation, error: invitationError } = await supabase
      .from("organization_invitations")
      .select("role, organization_id, email, accepted_at, expires_at")
      .eq("token", token)
      .single()

    if (
      invitationError ||
      !invitation ||
      invitation.organization_id !== organizationId ||
      invitation.email?.toLowerCase() !== email ||
      invitation.accepted_at ||
      (invitation.expires_at && new Date(invitation.expires_at) <= new Date())
    ) {
      return NextResponse.json(
        { success: false, error: "Invitacion invalida o expirada" },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "") || request.nextUrl.origin
    const inviteLink = `${baseUrl}/signup?token=${token}`

    // Send email if configured
    let emailSent = false
    if (isEmailConfigured()) {
      const result = await sendEmail({
        to: email,
        subject: `Invitación a ${org?.name || "CRM"}`,
        html: invitationEmailTemplate({
          organizationName: org.name,
          inviterName: adminProfile?.full_name || undefined,
          role: invitation?.role || "usuario",
          inviteLink,
        }),
      })
      emailSent = result.success
    }

    log.info("Organization invitation processed", {
      emailSent,
      email: maskEmail(email),
      organizationId,
    })

    return NextResponse.json({
      success: true,
      message: emailSent ? "Invitación enviada por email" : "Link de invitación generado",
      data: { inviteLink, emailSent },
    })
  } catch (error: any) {
    log.error("Error sending/generating organization invitation", error)
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
