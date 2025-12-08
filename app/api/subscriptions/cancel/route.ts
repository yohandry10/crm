import { NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { cancelSubscription, isStripeConfigured } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"

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

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Si tiene Stripe subscription, cancelar en Stripe
    if (isStripeConfigured() && organization.stripe_subscription_id) {
      await cancelSubscription(organization.stripe_subscription_id, true) // cancel at period end
      
      // Actualizar en BD
      await supabaseAdmin
        .from("organizations")
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId)
    } else {
      // Modo demo: cancelar inmediatamente
      await supabaseAdmin
        .from("organizations")
        .update({
          subscription_status: "cancelled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId)

      // Registrar en historial
      await supabaseAdmin.from("subscription_history").insert({
        organization_id: organizationId,
        plan: organization.subscription_plan,
        status: "cancelled",
        started_at: new Date().toISOString(),
        notes: "Cancelado por el usuario",
        created_by: user.id,
      })
    }

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
      message: organization.stripe_subscription_id 
        ? "Suscripción cancelada. Tendrás acceso hasta el final del período."
        : "Suscripción cancelada.",
    })
  } catch (error: any) {
    console.error("Cancel error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
