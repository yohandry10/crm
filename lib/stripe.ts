import Stripe from "stripe"

// Inicializar Stripe solo si hay API key
const stripeSecretKey = process.env.STRIPE_SECRET_KEY

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
      typescript: true,
    })
  : null

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET

// Mapeo de planes a Stripe Price IDs (configurar en .env o BD)
export const PLAN_PRICES: Record<string, { monthly: string; yearly: string }> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY || "",
    yearly: process.env.STRIPE_PRICE_STARTER_YEARLY || "",
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || "",
    yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY || "",
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY || "",
    yearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY || "",
  },
}

// Precios en centavos (para modo sin Stripe)
export const PLAN_AMOUNTS: Record<string, { monthly: number; yearly: number }> = {
  // Pricing "de mercado" (PEN) con anual = 2 meses gratis.
  starter: { monthly: 4900, yearly: 49000 }, // S/ 49, S/ 490
  professional: { monthly: 9900, yearly: 99000 }, // S/ 99, S/ 990
  enterprise: { monthly: 19900, yearly: 199000 }, // S/ 199, S/ 1990
}

export interface CreateCheckoutParams {
  organizationId: string
  organizationName: string
  customerEmail: string
  plan: "starter" | "professional" | "enterprise"
  billingPeriod: "monthly" | "yearly"
  successUrl: string
  cancelUrl: string
}

export async function createCheckoutSession(params: CreateCheckoutParams) {
  if (!stripe) {
    throw new Error("Stripe no está configurado")
  }

  const priceId = PLAN_PRICES[params.plan]?.[params.billingPeriod]
  if (!priceId) {
    throw new Error(`Price ID no configurado para ${params.plan} ${params.billingPeriod}`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    customer_email: params.customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    metadata: {
      organization_id: params.organizationId,
      plan: params.plan,
      billing_period: params.billingPeriod,
    },
    subscription_data: {
      metadata: {
        organization_id: params.organizationId,
        plan: params.plan,
      },
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    allow_promotion_codes: true,
  })

  return session
}

export async function createCustomerPortalSession(customerId: string, returnUrl: string) {
  if (!stripe) {
    throw new Error("Stripe no está configurado")
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  })

  return session
}

export async function cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true) {
  if (!stripe) {
    throw new Error("Stripe no está configurado")
  }

  if (cancelAtPeriodEnd) {
    // Cancelar al final del período (recomendado)
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  } else {
    // Cancelar inmediatamente
    return await stripe.subscriptions.cancel(subscriptionId)
  }
}

export async function getSubscription(subscriptionId: string) {
  if (!stripe) {
    throw new Error("Stripe no está configurado")
  }

  return await stripe.subscriptions.retrieve(subscriptionId)
}

export async function getCustomer(customerId: string) {
  if (!stripe) {
    throw new Error("Stripe no está configurado")
  }

  return await stripe.customers.retrieve(customerId)
}

export function isStripeConfigured(): boolean {
  return !!stripe && !!STRIPE_WEBHOOK_SECRET
}
