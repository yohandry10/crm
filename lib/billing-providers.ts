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

export const MANUAL_PAYMENT_GATEWAYS = [
  "bank_transfer",
  "cash",
  "yape",
  "plin",
  "manual",
] as const satisfies readonly ActivePaymentGateway[]

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

export function getAllowedPaymentGateways(env: Record<string, string | undefined> = process.env): ActivePaymentGateway[] {
  const configured = env.PAYMENT_GATEWAYS_ENABLED?.split(",")
    .map((gateway) => normalizePaymentGateway(gateway))
    .filter((gateway): gateway is ActivePaymentGateway => Boolean(gateway))

  if (configured?.length) return configured

  const provider = getBillingProvider(env)

  switch (provider) {
    case "culqi":
      return ["culqi", ...MANUAL_PAYMENT_GATEWAYS]
    case "pagoefectivo":
      return ["pagoefectivo", ...MANUAL_PAYMENT_GATEWAYS]
    case "culqi_pagoefectivo":
      return ["culqi", "pagoefectivo", ...MANUAL_PAYMENT_GATEWAYS]
    default:
      return [...MANUAL_PAYMENT_GATEWAYS]
  }
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
