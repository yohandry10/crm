import { NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { createSupabaseServiceClient } from "@/lib/supabase-service"

export async function POST() {
  try {
    const { user, organizationId, organization, role } = await getAuthenticatedContext()

    // Only owner can cancel subscription
    if (role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Solo el owner puede cancelar la suscripción" },
        { status: 403 }
      )
    }

    if (organization.subscription_status !== "active") {
      return NextResponse.json(
        { success: false, error: "No hay suscripción activa para cancelar" },
        { status: 400 }
      )
    }

    const supabaseAdmin = createSupabaseServiceClient()

    const { error: updateError } = await supabaseAdmin
      .from("organizations")
      .update({
        subscription_status: "cancelled",
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId)

    if (updateError) throw updateError

    const { error: historyError } = await supabaseAdmin.from("subscription_history").insert({
      organization_id: organizationId,
      plan: organization.subscription_plan,
      status: "cancelled",
      started_at: new Date().toISOString(),
      notes: "Cancelado por el usuario",
      created_by: user.id,
    })

    if (historyError) throw historyError

    // Log de auditoría
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      action: "cancel_subscription",
      target_type: "organization",
      target_id: organizationId,
      details: {
        plan: organization.subscription_plan,
        cancelled_by: "owner",
      },
    })

    return NextResponse.json({
      success: true,
      message: "Suscripción cancelada.",
    })
  } catch (error: any) {
    console.error("Cancel error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
