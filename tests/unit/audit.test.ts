import { describe, expect, it, vi } from "vitest"
import { getAuditRequestContext, logAuditEvent } from "@/lib/audit"

vi.mock("@/lib/supabase-service", () => ({
  createSupabaseServiceClient: vi.fn(),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe("audit trail", () => {
  it("extracts support context from request headers", () => {
    const request = new Request("https://crm.example.com/api/test", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
        "x-request-id": "req-123",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
    })

    expect(getAuditRequestContext(request)).toEqual({
      ipAddress: "203.0.113.10",
      userAgent: expect.stringContaining("Chrome"),
      requestId: "req-123",
      device: { os: "Windows", browser: "Chrome" },
    })
  })

  it("stores centralized metadata and redacts sensitive keys", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null })
    const supabase = { from: vi.fn(() => ({ insert })) }
    const request = new Request("https://crm.example.com/api/payments", {
      headers: {
        "x-real-ip": "203.0.113.11",
        "user-agent": "Firefox/120",
      },
    })

    await logAuditEvent({
      supabase: supabase as any,
      request,
      userId: "user-1",
      organizationId: "org-1",
      action: "PAYMENT_RECORDED",
      category: "billing",
      table: "payments",
      recordId: "not-a-uuid",
      metadata: { idempotency_key: "secret-key", amount: 10 },
      success: true,
    })

    expect(supabase.from).toHaveBeenCalledWith("auditoria")
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        usuario_id: "user-1",
        accion: "PAYMENT_RECORDED",
        tabla: "payments",
        registro_id: null,
        ip_address: "203.0.113.11",
        event_category: "billing",
        severity: "info",
        success: true,
        request_id: expect.any(String),
      })
    )

    const payload = insert.mock.calls[0][0]
    expect(payload.datos_nuevos.audit.metadata.idempotency_key).toBe("[REDACTED]")
    expect(payload.datos_nuevos.audit.metadata.amount).toBe(10)
  })
})
