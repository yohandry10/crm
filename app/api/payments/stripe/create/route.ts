import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import crypto from "crypto"

const stripeSecret = process.env.STRIPE_SECRET_KEY

const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" }) : null

export async function POST(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rate) return rate

    if (!stripe) {
      throw new Error("Stripe no configurado. Define STRIPE_SECRET_KEY.")
    }

    const origin = new URL(request.url).origin
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${origin}/success`
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${origin}/cancel`

    // MULTI-TENANT: Get organization context
    const { user, organizationId } = await getAuthenticatedContext()
    const body = await request.json()
    const { invoice_id, amount, currency = "PEN" } = body

    if (!invoice_id || !amount || amount <= 0) {
      throw new ValidationError("invoice_id y amount son requeridos y amount debe ser > 0")
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `Factura ${invoice_id}` },
            unit_amount: Math.round(Number(amount) * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        invoice_id,
        organization_id: organizationId,
        user_id: user.id
      }
    })

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id
    })
  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/payments/stripe/create",
      method: "POST",
      error,
      requestBody: await request.clone().json().catch(() => undefined),
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
