import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { createClient } from "@supabase/supabase-js"
import { createCheckoutSession, isStripeConfigured, PLAN_AMOUNTS } from "@/lib/stripe"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
    if (rateLimitResponse) return rateLimitResponse

    const { user, organizationId, organization, role } = await getAuthenticatedContext()
    const body = await request.json()

    const { plan, billingPeriod } = body

    if (!plan || !billingPeriod) {
      return NextResponse.json(
        { success: false, error: "Plan y período de facturación requeridos" },
        { status: 400 }
      )
    }

    // Only owner can manage subscriptions
    if (role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Solo el owner puede gestionar suscripciones" },
        { status: 403 }
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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

    // Si Stripe está configurado, crear sesión de checkout
    if (isStripeConfigured()) {
      try {
        const session = await createCheckoutSession({
          organizationId,
          organizationName: organization.name,
          customerEmail: user.email!,
          plan: plan as "starter" | "professional" | "enterprise",
          billingPeriod: billingPeriod as "monthly" | "yearly",
          successUrl: `${baseUrl}/settings/billing?success=true`,
          cancelUrl: `${baseUrl}/settings/billing?cancelled=true`,
        })

        return NextResponse.json({
          success: true,
          checkoutUrl: session.url,
        })
      } catch (stripeError: any) {
        console.error("Stripe checkout error:", stripeError)
        // Si falla Stripe, continuar con activación manual
      }
    }

    // Modo demo/testing: activación directa sin pago
    const amount = PLAN_AMOUNTS[plan]?.[billingPeriod as "monthly" | "yearly"] || 
                   (billingPeriod === "yearly" ? planData.price_yearly * 100 : planData.price_monthly * 100)

    const { error } = await supabaseAdmin.rpc("activate_subscription", {
      p_organization_id: organizationId,
      p_plan: plan,
      p_billing_period: billingPeriod,
      p_payment_reference: `DEMO-${Date.now()}`,
      p_activated_by: user.id,
    })

    if (error) throw error

    return NextResponse.json({
      success: true,
      message: "Suscripción activada (modo demo)",
      data: {
        plan,
        billingPeriod,
        amount: amount / 100,
        demo: true,
      },
    })
  } catch (error: any) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
