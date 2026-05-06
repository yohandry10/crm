import { describe, expect, it, vi } from "vitest"
import {
  ACTIVE_PAYMENT_GATEWAYS,
  getAllowedPaymentGateways,
  getBillingProvider,
  normalizePaymentGateway,
  PLAN_AMOUNTS,
} from "@/lib/billing-providers"

describe("billing providers", () => {
  it("keeps subscription plan amounts in PEN cents", () => {
    expect(PLAN_AMOUNTS.starter.monthly).toBe(4900)
    expect(PLAN_AMOUNTS.professional.monthly).toBe(9900)
    expect(PLAN_AMOUNTS.enterprise.monthly).toBe(19900)
    expect(PLAN_AMOUNTS.starter.monthly).toBeLessThan(PLAN_AMOUNTS.professional.monthly)
    expect(PLAN_AMOUNTS.professional.monthly).toBeLessThan(PLAN_AMOUNTS.enterprise.monthly)
  })

  it("normalizes only active non-Stripe payment gateways", () => {
    expect(normalizePaymentGateway("culqi")).toBe("culqi")
    expect(normalizePaymentGateway("PagoEfectivo")).toBe("pagoefectivo")
    expect(normalizePaymentGateway("stripe")).toBeNull()
    expect(ACTIVE_PAYMENT_GATEWAYS).not.toContain("stripe")
  })

  it("uses configured gateway allowlist when present", () => {
    vi.stubEnv("PAYMENT_GATEWAYS_ENABLED", "culqi,pagoefectivo")

    expect(getAllowedPaymentGateways()).toEqual(["culqi", "pagoefectivo"])

    vi.unstubAllEnvs()
  })

  it("falls back to manual billing provider for unsupported values", () => {
    expect(getBillingProvider({ BILLING_PROVIDER: "stripe" })).toBe("manual")
    expect(getBillingProvider({ BILLING_PROVIDER: "culqi_pagoefectivo" })).toBe("culqi_pagoefectivo")
  })
})
