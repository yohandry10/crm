import { describe, expect, it, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

// Mock de módulos ANTES de importar las rutas
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => null),
  RATE_LIMITS: { read: { interval: 60000, maxRequests: 100 }, write: { interval: 60000, maxRequests: 50 }, sensitive: { interval: 60000, maxRequests: 10 } },
}))

vi.mock("@/lib/error-logging", () => ({
  logError: vi.fn(),
}))

// Mock data
const mockUser = { id: "user-123", email: "test@test.com" }
const mockOrgId = "org-123"

type SupabaseDataMap = Record<string, any[]>

function createQuery(data: any[], countOverride?: number) {
  const payload = { data, error: null as any, count: countOverride ?? data.length }

  const query: any = {
    select: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    eq: vi.fn(() => query),
    neq: vi.fn(() => query),
    in: vi.fn(() => query),
    is: vi.fn(() => query),
    or: vi.fn(() => query),
    order: vi.fn(() => query),
    contains: vi.fn(() => query),
    range: vi.fn(() => Promise.resolve({ ...payload })),
    limit: vi.fn(() => Promise.resolve({ ...payload })),
    single: vi.fn(() => Promise.resolve({ ...payload, data: data[0] })),
    maybeSingle: vi.fn(() => Promise.resolve({ ...payload, data: data[0] })),
    then: (resolve: any) => resolve({ ...payload }),
  }

  return query
}

function createSupabaseStub(map: SupabaseDataMap = {}, rpcOverrides: Record<string, any> = {}) {
  return {
    from: vi.fn((table: string) => createQuery(map[table] ?? [])),
    rpc: vi.fn((fn: string, _params?: any) => {
      if (rpcOverrides[fn] !== undefined) {
        return Promise.resolve({ data: rpcOverrides[fn], error: null })
      }
      if (fn === "create_invoice_with_items_atomic") {
        return Promise.resolve({
          data: {
            invoice_id: "inv-1",
            invoice_number: "F001-00001",
            total_amount: 150,
            items_created: 1,
          },
          error: null,
        })
      }
      if (fn === "get_unreconciled_payments") {
        return Promise.resolve({ data: map.unreconciled ?? [], error: null })
      }
      if (fn === "manual_reconcile_payment") {
        return Promise.resolve({ data: { success: true, status: "matched" }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    }),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: mockUser }, error: null })),
    },
  }
}

let supabaseStub: ReturnType<typeof createSupabaseStub>

vi.mock("@/lib/supabase-auth", () => ({
  getAuthenticatedContext: vi.fn(async () => ({
    supabase: supabaseStub,
    user: mockUser,
    organizationId: mockOrgId,
    role: "admin",
  })),
  requireAuth: vi.fn(async () => mockUser),
  createSupabaseRouteClient: () => supabaseStub,
}))

// Importar rutas DESPUÉS de los mocks
import { GET as invoicesGET, POST as invoicesPOST } from "@/app/api/invoices/route"
import { GET as paymentsReconcileGET, POST as paymentsReconcilePOST } from "@/app/api/payments/reconcile/route"
import { GET as analyticsGET } from "@/app/api/analytics/route"

describe("Integración finanzas y analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    supabaseStub = createSupabaseStub()
  })

  it("GET /api/invoices responde con datos paginados", async () => {
    supabaseStub = createSupabaseStub({
      invoices: [
        { id: "inv-1", invoice_number: "F001-1", total: 100, status: "paid", organization_id: mockOrgId },
        { id: "inv-2", invoice_number: "F001-2", total: 200, status: "sent", organization_id: mockOrgId },
      ],
    })

    const request = new NextRequest("http://localhost/api/invoices?limit=10", { method: "GET" })
    const response = await invoicesGET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it.skip("POST /api/invoices crea factura mediante RPC - requiere entorno completo", async () => {
    // Este test requiere un Request que soporte clone() correctamente
    // El error "unusable" ocurre porque request.clone().json() falla en vitest
    supabaseStub = createSupabaseStub({}, {
      create_invoice_with_items_atomic: {
        invoice_id: "inv-1",
        invoice_number: "F001-00001",
        total_amount: 150,
        items_created: 1,
      }
    })

    const request = new NextRequest("http://localhost/api/invoices", {
      method: "POST",
      body: JSON.stringify({
        contact_id: "550e8400-e29b-41d4-a716-446655440000",
        items: [{ description: "Servicio de consultoría", quantity: 1, unit_price: 100, tax_rate: 0.18 }],
        issue_date: "2025-12-01",
        due_date: "2025-12-31",
        currency: "PEN",
        status: "draft"
      }),
      headers: { "content-type": "application/json" },
    })

    const response = await invoicesPOST(request as any)
    expect(response.status).toBe(200)
  })

  it("POST /api/payments/reconcile valida payload y responde éxito", async () => {
    supabaseStub = createSupabaseStub({}, {
      manual_reconcile_payment: { success: true, status: "matched" }
    })

    // reconcileSchema requiere: payment_id (uuid), invoice_id (uuid)
    const request = new NextRequest("http://localhost/api/payments/reconcile", {
      method: "POST",
      body: JSON.stringify({
        payment_id: "550e8400-e29b-41d4-a716-446655440001",
        invoice_id: "550e8400-e29b-41d4-a716-446655440002",
      }),
      headers: { "content-type": "application/json" },
    })

    const response = await paymentsReconcilePOST(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it("GET /api/payments/reconcile devuelve pagos pendientes", async () => {
    supabaseStub = createSupabaseStub({
      unreconciled: [{ id: "pay-1", amount: 100 }],
    })

    const request = new NextRequest("http://localhost/api/payments/reconcile", { method: "GET" })
    const response = await paymentsReconcileGET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it("GET /api/analytics calcula métricas", async () => {
    supabaseStub = createSupabaseStub({
      contacts: [
        { id: "c1", lead_status: "warm", lead_score: 50, created_at: new Date().toISOString(), organization_id: mockOrgId },
        { id: "c2", lead_status: "hot", lead_score: 80, created_at: new Date().toISOString(), organization_id: mockOrgId },
      ],
      invoices: [
        { id: "inv1", contact_id: "c1", total: 100, status: "paid", issue_date: new Date().toISOString(), organization_id: mockOrgId },
      ],
      payments: [
        { id: "pay1", amount: 150, paid_at: new Date().toISOString(), status: "completed", organization_id: mockOrgId },
      ],
      opportunities: [
        { id: "opp1", expected_revenue: 300, status: "won", created_at: new Date().toISOString(), organization_id: mockOrgId },
      ],
      campaigns: [
        { id: "camp1", budget: 1000, status: "active", type: "ads", organization_id: mockOrgId },
      ],
    })

    const request = new NextRequest("http://localhost/api/analytics", { method: "GET" })
    const response = await analyticsGET(request as any)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })
})
