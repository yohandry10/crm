import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { getBillingProvider, getBillingProviderLabel, PLAN_AMOUNTS } from "@/lib/billing-providers"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { z } from "zod"

const checkoutSchema = z.object({
  plan: z.enum(["starter", "professional", "enterprise"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
})

function createPaymentReference(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
    if (rateLimitResponse) return rateLimitResponse

    const { user, organizationId, role } = await getAuthenticatedContext()
    const parsed = checkoutSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { plan, billingPeriod } = parsed.data

    // Only owner can manage subscriptions
    if (role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Solo el owner puede gestionar suscripciones" },
        { status: 403 }
      )
    }

    const supabaseAdmin = createSupabaseServiceClient()

    // Get plan details
    const { data: planData } = await supabaseAdmin
      .from("subscription_plans")
      .select("*")
      .eq("name", plan)
      .single()

    if (!planData) {
      return NextResponse.json(
        { success: false, error: "Plan no encontrado" },
        { status: 404 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "") || request.nextUrl.origin
    const amount = PLAN_AMOUNTS[plan]?.[billingPeriod] ||
                   (billingPeriod === "yearly" ? planData.price_yearly * 100 : planData.price_monthly * 100)
    const billingProvider = getBillingProvider()

    if (billingProvider === "disabled") {
      return NextResponse.json(
        { success: false, error: "La facturacion esta deshabilitada" },
        { status: 503 }
      )
    }

    const paymentReference = createPaymentReference(billingProvider.toUpperCase())

    const { error: historyError } = await supabaseAdmin.from("subscription_history").insert({
      organization_id: organizationId,
      plan,
      status: "past_due",
      amount: amount / 100,
      currency: planData.currency || "PEN",
      billing_period: billingPeriod,
      payment_method: getBillingProviderLabel(billingProvider),
      payment_reference: paymentReference,
      notes: `Pendiente de confirmacion por ${getBillingProviderLabel(billingProvider)}`,
      created_by: user.id,
    })

    if (historyError) throw historyError

    const { error: auditError } = await supabaseAdmin.from("admin_audit_logs").insert({
      admin_user_id: user.id,
      action: "subscription_payment_requested",
      target_type: "organization",
      target_id: organizationId,
      details: {
        plan,
        billing_period: billingPeriod,
        payment_provider: billingProvider,
        payment_reference: paymentReference,
        amount: amount / 100,
        return_url: `${baseUrl}/settings/billing`,
      },
    })

    if (auditError) throw auditError

    return NextResponse.json(
      {
        success: true,
        pendingPayment: true,
        message: `Solicitud registrada. El pago queda pendiente de confirmacion por ${getBillingProviderLabel(billingProvider)}.`,
        data: {
          plan,
          billingPeriod,
          amount: amount / 100,
          provider: billingProvider,
          paymentReference,
        },
      },
      { status: 202 }
    )
  } catch (error: any) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
