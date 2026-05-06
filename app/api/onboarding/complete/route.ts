import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { createRequestLogger } from "@/lib/logger"
import { z } from "zod"

const onboardingRoleSchema = z.enum(["admin", "manager", "member", "viewer"])
const optionalText = (max: number) => z.string().trim().max(max).optional().nullable()

const onboardingSchema = z.object({
  organizationId: z.string().uuid("Organization ID inválido"),
  companyData: z.object({
    name: z.string().trim().min(1, "Nombre requerido").max(120),
    ruc: z.string().trim().regex(/^\d{11}$/, "RUC inválido").optional().nullable().or(z.literal("")),
    address: optionalText(300),
    phone: optionalText(50),
    email: z.string().trim().email("Email inválido").optional().nullable().or(z.literal("")),
  }),
  configData: z.object({
    currency: z.enum(["PEN", "USD"]).default("PEN"),
    taxRate: z.number().min(0).max(1).default(0.18),
    serieFactura: z.string().trim().regex(/^[A-Z0-9]{1,10}$/i, "Serie de factura inválida").default("F001"),
    serieBoleta: z.string().trim().regex(/^[A-Z0-9]{1,10}$/i, "Serie de boleta inválida").default("B001"),
    timezone: z.string().trim().min(1).max(80).default("America/Lima"),
  }),
  teamMembers: z.array(z.object({
    email: z.string().trim().toLowerCase().email("Email de invitado inválido"),
    role: onboardingRoleSchema,
  })).max(20, "Máximo 20 invitaciones").default([]),
}).superRefine((value, ctx) => {
  const seen = new Set<string>()
  value.teamMembers.forEach((member, index) => {
    if (seen.has(member.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamMembers", index, "email"],
        message: "Email duplicado",
      })
    }
    seen.add(member.email)
  })
})

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const parsed = onboardingSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { organizationId, companyData, configData, teamMembers } = parsed.data

    // Verify user is owner/admin of this organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para completar el onboarding" },
        { status: 403 }
      )
    }

    // Use service role for updates
    const supabaseAdmin = createSupabaseServiceClient()

    // Update organization with ALL data (company + config)
    const { error: orgError } = await supabaseAdmin
      .from("organizations")
      .update({
        // Company data
        name: companyData.name,
        legal_name: companyData.name,
        ruc: companyData.ruc || null,
        address: companyData.address || null,
        phone: companyData.phone || null,
        email: companyData.email || null,
        // Config data
        currency: configData.currency,
        default_tax_rate: configData.taxRate,
        serie_factura: configData.serieFactura,
        serie_boleta: configData.serieBoleta,
        timezone: configData.timezone,
        // Onboarding status
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId)
      .select("id")
      .single()

    if (orgError) throw orgError

    // Send team invitations
    if (teamMembers.length > 0) {
      log.info("Creating onboarding invitations", { count: teamMembers.length, organizationId })
      for (const member of teamMembers) {
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", member.email)
          .maybeSingle()

        if (existingProfile?.id) {
          const { data: existingMember } = await supabaseAdmin
            .from("organization_members")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("user_id", existingProfile.id)
            .maybeSingle()

          if (existingMember) continue
        }

        const { data: existingInvite } = await supabaseAdmin
          .from("organization_invitations")
          .select("id")
          .eq("organization_id", organizationId)
          .eq("email", member.email)
          .is("accepted_at", null)
          .maybeSingle()

        if (existingInvite) continue

        const token = crypto.randomUUID().replace(/-/g, "")

        const { error: inviteError } = await supabaseAdmin
          .from("organization_invitations")
          .insert({
            organization_id: organizationId,
            email: member.email,
            role: member.role,
            token,
            invited_by: user.id,
          })

        if (inviteError) throw inviteError
      }
    }

    return NextResponse.json({
      success: true,
      message: "Onboarding completado",
    })
  } catch (error: any) {
    log.error("Onboarding error", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
