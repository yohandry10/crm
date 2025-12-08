import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const body = await request.json()

    const { organizationId, companyData, configData, teamMembers } = body

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "Organization ID requerido" },
        { status: 400 }
      )
    }

    // Verify user is owner/admin of this organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para completar el onboarding" },
        { status: 403 }
      )
    }

    // Use service role for updates
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Update organization with ALL data (company + config)
    const { error: orgError } = await supabaseAdmin
      .from("organizations")
      .update({
        // Company data
        name: companyData.name,
        legal_name: companyData.name,
        ruc: companyData.ruc,
        address: companyData.address,
        phone: companyData.phone,
        email: companyData.email,
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

    if (orgError) throw orgError

    // Send team invitations
    if (teamMembers && teamMembers.length > 0) {
      for (const member of teamMembers) {
        const token = crypto.randomUUID().replace(/-/g, "")
        
        await supabaseAdmin
          .from("organization_invitations")
          .insert({
            organization_id: organizationId,
            email: member.email,
            role: member.role,
            token,
            invited_by: user.id,
          })

        console.log(`Invitation for ${member.email}: /signup?token=${token}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Onboarding completado",
    })
  } catch (error: any) {
    console.error("Onboarding error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
