import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logError } from "@/lib/error-logging"
import crypto from "crypto"

const stripeSecret = process.env.STRIPE_SECRET_KEY
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2025-02-24.acacia" }) : null

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !webhookSecret) {
      return NextResponse.json({ success: false, error: "Stripe no configurado" }, { status: 500 })
    }

    const rawBody = await request.arrayBuffer()
    const signature = request.headers.get("stripe-signature")

    if (!signature) {
      return NextResponse.json({ success: false, error: "Missing signature" }, { status: 400 })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(Buffer.from(rawBody), signature, webhookSecret)
    } catch (err: any) {
      return NextResponse.json({ success: false, error: `Signature verification failed: ${err.message}` }, { status: 400 })
    }

    // Procesar eventos relevantes
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session
      const invoice_id = session.metadata?.invoice_id
      const user_id = session.metadata?.user_id
      const payment_intent = session.payment_intent?.toString()
      const amount = session.amount_total ? session.amount_total / 100 : null

      if (invoice_id && user_id && amount) {
        const supabase = createSupabaseServiceClient()
        // Usar RPC atómica existente
        await supabase.rpc("process_payment_atomic", {
          p_user_id: user_id,
          p_invoice_id: invoice_id,
          p_amount: amount,
          p_payment_method: "card",
          p_gateway: "stripe",
          p_transaction_id: payment_intent || session.id
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/payments/stripe/webhook",
      method: "POST",
      error,
    })
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
