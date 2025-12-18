import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe"
import { createClient } from "@supabase/supabase-js"
import { logger } from "@/lib/logger"
import Stripe from "stripe"

// Supabase admin client para webhooks
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Stripe not configured" },
      { status: 500 }
    )
  }

  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get("stripe-signature")

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    logger.warn("Stripe webhook signature verification failed", { message: err?.message })
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    )
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Verificar idempotencia - no procesar eventos duplicados
  const { data: existingEvent } = await supabaseAdmin
    .from("stripe_events")
    .select("id")
    .eq("id", event.id)
    .single()

  if (existingEvent) {
    logger.info("Stripe event already processed, skipping", { eventId: event.id, eventType: event.type })
    return NextResponse.json({ received: true, skipped: true })
  }

  // Guardar evento para idempotencia
  await supabaseAdmin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    data: event.data,
  })

  logger.info("Processing Stripe event", { eventId: event.id, eventType: event.type })

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      default:
        logger.info("Unhandled Stripe event type", { eventId: event.id, eventType: event.type })
    }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error("Error processing Stripe event", error, { eventId: event.id, eventType: event.type })
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organizationId = session.metadata?.organization_id
  const plan = session.metadata?.plan
  const billingPeriod = session.metadata?.billing_period

  if (!organizationId || !plan) {
    logger.error("Missing metadata in checkout session", undefined, { hasOrganizationId: !!organizationId, hasPlan: !!plan })
    return
  }

  const subscription = await stripe!.subscriptions.retrieve(session.subscription as string)
  const amount = subscription.items.data[0]?.price?.unit_amount || 0

  await getSupabaseAdmin().rpc("process_stripe_checkout_completed", {
    p_stripe_customer_id: session.customer as string,
    p_stripe_subscription_id: session.subscription as string,
    p_organization_id: organizationId,
    p_plan: plan,
    p_billing_period: billingPeriod || "monthly",
    p_amount: amount,
    p_current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
  })

  logger.info("Stripe checkout completed", { organizationId, plan })
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.subscription) return

  await getSupabaseAdmin().rpc("process_stripe_invoice_paid", {
    p_stripe_invoice_id: invoice.id,
    p_stripe_customer_id: invoice.customer as string,
    p_stripe_subscription_id: invoice.subscription as string,
    p_amount_paid: invoice.amount_paid,
    p_currency: invoice.currency,
    p_invoice_pdf: invoice.invoice_pdf,
    p_hosted_invoice_url: invoice.hosted_invoice_url,
    p_period_start: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
    p_period_end: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
  })

  logger.info("Stripe invoice paid", { invoiceId: invoice.id })
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  await getSupabaseAdmin().rpc("process_stripe_payment_failed", {
    p_stripe_customer_id: invoice.customer as string,
  })

  logger.info("Stripe payment failed", { customerId: invoice.customer })
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = getSupabaseAdmin()
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single()

  if (!org) return

  await supabase
    .from("organizations")
    .update({
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      subscription_ends_at: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", org.id)

  logger.info("Stripe subscription updated", { subscriptionId: subscription.id })
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  await getSupabaseAdmin().rpc("process_stripe_subscription_cancelled", {
    p_stripe_subscription_id: subscription.id,
  })

  logger.info("Stripe subscription cancelled", { subscriptionId: subscription.id })
}
