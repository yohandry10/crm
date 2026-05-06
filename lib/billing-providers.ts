export const PLAN_AMOUNTS: Record<string, { monthly: number; yearly: number }> = {
  starter: { monthly: 4900, yearly: 49000 },
  professional: { monthly: 9900, yearly: 99000 },
  enterprise: { monthly: 19900, yearly: 199000 },
}

export const ACTIVE_PAYMENT_GATEWAYS = [
  "culqi",
  "pagoefectivo",
  "bank_transfer",
  "cash",
  "yape",
  "plin",
  "manual",
] as const

export const BILLING_PROVIDERS = [
  "disabled",
  "manual",
  "culqi",
  "pagoefectivo",
  "culqi_pagoefectivo",
] as const

export type ActivePaymentGateway = (typeof ACTIVE_PAYMENT_GATEWAYS)[number]
export type BillingProvider = (typeof BILLING_PROVIDERS)[number]

const BILLING_PROVIDER_SET = new Set<string>(BILLING_PROVIDERS)
const PAYMENT_GATEWAY_SET = new Set<string>(ACTIVE_PAYMENT_GATEWAYS)

export function normalizePaymentGateway(value: string): ActivePaymentGateway | null {
  const normalized = value.trim().toLowerCase()
  return PAYMENT_GATEWAY_SET.has(normalized) ? (normalized as ActivePaymentGateway) : null
}

export function getAllowedPaymentGateways(): ActivePaymentGateway[] {
  const configured = process.env.PAYMENT_GATEWAYS_ENABLED?.split(",")
    .map((gateway) => normalizePaymentGateway(gateway))
    .filter((gateway): gateway is ActivePaymentGateway => Boolean(gateway))

  return configured?.length ? configured : [...ACTIVE_PAYMENT_GATEWAYS]
}

export function getBillingProvider(env: Record<string, string | undefined> = process.env): BillingProvider {
  const provider = env.BILLING_PROVIDER?.trim().toLowerCase() || "manual"
  return BILLING_PROVIDER_SET.has(provider) ? (provider as BillingProvider) : "manual"
}

export function isManualBillingProvider(provider = getBillingProvider()): boolean {
  return provider === "disabled" || provider === "manual"
}

export function getBillingProviderLabel(provider = getBillingProvider()): string {
  switch (provider) {
    case "culqi":
      return "Culqi"
    case "pagoefectivo":
      return "PagoEfectivo"
    case "culqi_pagoefectivo":
      return "Culqi / PagoEfectivo"
    case "disabled":
      return "deshabilitado"
    default:
      return "manual"
  }
}
