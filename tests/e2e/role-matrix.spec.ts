import { expect, test, type APIResponse } from "@playwright/test"
import { expectNoTrialGate } from "./helpers"

const roles = ["owner", "admin", "manager", "member", "viewer"] as const

const corePages = [
  "/dashboard",
  "/contacts",
  "/leads",
  "/products",
  "/tasks",
  "/tickets",
  "/analytics",
  "/reports/builder",
]

const sensitiveReadRoutes = [
  "/api/settings",
  "/api/integrations",
  "/api/webhooks",
]

const canManageSensitive = new Set(["owner", "admin"])
const canCreateContacts = new Set(["owner", "admin", "manager", "member"])
const canCreateOpportunities = new Set(["owner", "admin", "manager", "member"])
const canCreateQuotes = new Set(["owner", "admin", "manager", "member"])
const canCreateInvoices = new Set(["owner", "admin", "manager", "member"])
const canCreateProducts = new Set(["owner", "admin", "manager"])
const canCreateTickets = new Set(["owner", "admin", "manager"])
const canCreateCampaigns = new Set(["owner", "admin", "manager"])
const canCreateWorkflows = new Set(["owner", "admin"])
const canCreateCalendarEvents = new Set(["owner", "admin", "manager", "member"])

async function expectWritePermission(
  response: APIResponse,
  allowed: boolean,
  role: string,
  route: string
) {
  if (allowed) {
    expect(response.ok(), `${role} should create ${route}: ${await response.text()}`).toBeTruthy()
  } else {
    expect(response.status(), `${role} should be denied ${route}: ${await response.text()}`).toBe(403)
  }
}

for (const role of roles) {
  test.describe(`organization role: ${role}`, () => {
    test.use({ storageState: `tests/e2e/.auth/${role}.json` })

    test("loads daily read surfaces without admin leakage or trial gate", async ({ page }) => {
      for (const path of corePages) {
        await page.goto(path)
        await expect(page).not.toHaveURL(/\/login/)
        await expect(page.getByText("Super Admin")).toHaveCount(0)
        await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0)
        await expectNoTrialGate(page)
      }
    })

    test("receives the expected team role context", async ({ request }) => {
      const response = await request.get("/api/team")
      expect(response.ok(), await response.text()).toBeTruthy()
      const json = await response.json()

      expect(json.success).toBe(true)
      expect(json.data.currentUserRole).toBe(role)
      expect(Array.isArray(json.data.members)).toBe(true)
      expect(json.data.members.some((member: any) => member.role === role)).toBe(true)
    })

    test("enforces sensitive module access", async ({ request }) => {
      for (const route of sensitiveReadRoutes) {
        const response = await request.get(route)
        if (canManageSensitive.has(role)) {
          expect(response.ok(), `${role} should read ${route}: ${await response.text()}`).toBeTruthy()
        } else {
          expect(response.status(), `${role} should be denied ${route}`).toBe(403)
        }
      }
    })

    test("enforces team invitation permissions", async ({ request }) => {
      const response = await request.post("/api/team/invite", {
        data: {
          email: `invite.${role}.${Date.now()}@example.org`,
          role: "member",
        },
      })

      if (canManageSensitive.has(role)) {
        expect(response.ok(), await response.text()).toBeTruthy()
      } else {
        expect(response.status(), await response.text()).toBe(403)
      }
    })

    test("enforces daily write permissions", async ({ request }) => {
      const stamp = Date.now()

      const contactsResponse = await request.get("/api/contacts?limit=1")
      expect(contactsResponse.ok(), await contactsResponse.text()).toBeTruthy()
      const contactsJson = await contactsResponse.json()
      const seedContactId = contactsJson.data?.[0]?.id
      expect(seedContactId, "E2E seed contact should exist").toBeTruthy()

      const contactResponse = await request.post("/api/contacts", {
        data: {
          name: `Role ${role} Contact ${stamp}`,
          email: `role.${role}.contact.${stamp}@example.org`,
          phone: "+51999111222",
          lead_status: "cold",
          source: "web",
        },
      })

      await expectWritePermission(contactResponse, canCreateContacts.has(role), role, "/api/contacts")

      const opportunityResponse = await request.post("/api/opportunities", {
        data: {
          name: `Role ${role} Opportunity ${stamp}`,
          contact_id: seedContactId,
          stage_id: "prospecting",
          expected_revenue: 1500,
          probability: 25,
        },
      })

      await expectWritePermission(opportunityResponse, canCreateOpportunities.has(role), role, "/api/opportunities")

      const productResponse = await request.post("/api/products", {
        data: {
          name: `Role ${role} Product ${stamp}`,
          sku: `ROLE-${role}-${stamp}`,
          unit_price: 25,
          cost_price: 10,
          stock_quantity: 2,
        },
      })

      await expectWritePermission(productResponse, canCreateProducts.has(role), role, "/api/products")

      const quoteResponse = await request.post("/api/quotes", {
        data: {
          contact_id: seedContactId,
          notes: `Role ${role} quote`,
          items: [{ description: `Role ${role} service`, quantity: 1, unit_price: 75 }],
        },
      })

      await expectWritePermission(quoteResponse, canCreateQuotes.has(role), role, "/api/quotes")

      const invoiceResponse = await request.post("/api/invoices", {
        data: {
          contact_id: seedContactId,
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          notes: `Role ${role} invoice`,
          items: [{ description: `Role ${role} service`, quantity: 1, unit_price: 90, tax_rate: 0.18 }],
        },
      })

      await expectWritePermission(invoiceResponse, canCreateInvoices.has(role), role, "/api/invoices")

      const ticketResponse = await request.post("/api/tickets", {
        data: {
          title: `Role ${role} Ticket ${stamp}`,
          description: "Permission matrix ticket",
          priority: "medium",
          status: "open",
        },
      })

      await expectWritePermission(ticketResponse, canCreateTickets.has(role), role, "/api/tickets")

      const campaignResponse = await request.post("/api/campaigns", {
        data: {
          name: `Role ${role} Campaign ${stamp}`,
          type: "email",
          status: "draft",
          subject: "E2E",
          content: "Mensaje de prueba",
          target_segment: { type: "all_contacts" },
          budget: 0,
        },
      })

      await expectWritePermission(campaignResponse, canCreateCampaigns.has(role), role, "/api/campaigns")

      const workflowResponse = await request.post("/api/workflows", {
        data: {
          name: `Role ${role} Workflow ${stamp}`,
          description: "Role matrix workflow",
          trigger_type: "contact.created",
          trigger_conditions: {},
          actions: [],
          is_active: true,
        },
      })

      await expectWritePermission(workflowResponse, canCreateWorkflows.has(role), role, "/api/workflows")

      const start = new Date(Date.now() + 24 * 60 * 60 * 1000)
      const end = new Date(start.getTime() + 30 * 60 * 1000)
      const calendarResponse = await request.post("/api/calendar/events", {
        data: {
          title: `Role ${role} Event ${stamp}`,
          start: start.toISOString(),
          end: end.toISOString(),
          event_type: "meeting",
          contact_id: seedContactId,
        },
      })

      await expectWritePermission(calendarResponse, canCreateCalendarEvents.has(role), role, "/api/calendar/events")
    })
  })
}
