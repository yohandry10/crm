import { expect, test, type APIRequestContext } from "@playwright/test"
import { expectJsonSuccess } from "./helpers"

type CreatedRecords = Partial<Record<"account" | "contact" | "product" | "opportunity" | "task" | "ticket" | "quote", string>>

async function deleteIfPresent(request: APIRequestContext, path: string, id?: string) {
  if (!id) return
  const response = await request.delete(`${path}/${id}`)
  expect([200, 204, 404], await response.text()).toContain(response.status())
}

test("core CRM entities connect through the expected business flow", async ({ request }) => {
  const suffix = Date.now()
  const created: CreatedRecords = {}

  try {
    const account = await expectJsonSuccess(await request.post("/api/accounts", {
      data: {
        name: `E2E Account ${suffix}`,
        industry: "QA",
        phone: "999999999",
        city: "Lima",
        country: "Peru",
      },
    }))
    created.account = account.data.id

    const contact = await expectJsonSuccess(await request.post("/api/contacts", {
      data: {
        name: `E2E Contact ${suffix}`,
        email: `e2e.contact.${suffix}@example.com`,
        phone: "999999999",
        company: `E2E Account ${suffix}`,
        lead_status: "warm",
        tags: ["e2e"],
      },
    }))
    created.contact = contact.data.id

    const product = await expectJsonSuccess(await request.post("/api/products", {
      data: {
        sku: `E2E-${suffix}`,
        name: `E2E Product ${suffix}`,
        unit_price: 25,
        cost_price: 10,
        currency: "PEN",
        tax_rate: 18,
        is_service: false,
        stock_quantity: 5,
        min_stock: 1,
      },
    }))
    created.product = product.data.id

    const movement = await expectJsonSuccess(await request.post("/api/inventory/movements", {
      data: {
        product_id: created.product,
        type: "in",
        quantity: 2,
        reason: "e2e stock input",
        notes: "accepted by API but not persisted without DB column",
      },
    }))
    expect(movement.data.new_quantity).toBe(7)

    const inventoryItem = await expectJsonSuccess(await request.get(`/api/inventory/${created.product}`))
    expect(inventoryItem.data.quantity).toBe(7)

    const opportunity = await expectJsonSuccess(await request.post("/api/opportunities", {
      data: {
        name: `E2E Opportunity ${suffix}`,
        contact_id: created.contact,
        stage_id: "prospecting",
        expected_revenue: 100,
        description: "e2e opportunity",
      },
    }))
    created.opportunity = opportunity.data.id

    const task = await expectJsonSuccess(await request.post("/api/tasks", {
      data: {
        title: `E2E Task ${suffix}`,
        description: "e2e task",
        contact_id: created.contact,
        priority: "medium",
        status: "pending",
      },
    }))
    created.task = task.data.id

    const ticket = await expectJsonSuccess(await request.post("/api/tickets", {
      data: {
        title: `E2E Ticket ${suffix}`,
        description: "e2e ticket",
        account_id: created.account,
        contact_id: created.contact,
        priority: "medium",
        status: "open",
      },
    }))
    created.ticket = ticket.data.id

    const quote = await expectJsonSuccess(await request.post("/api/quotes", {
      data: {
        contact_id: created.contact,
        opportunity_id: created.opportunity,
        notes: "e2e quote",
        items: [
          {
            product_id: created.product,
            description: "E2E Product",
            quantity: 1,
            unit_price: 25,
          },
        ],
      },
    }))
    created.quote = quote.data.id

    const draftConvert = await request.post(`/api/quotes/${created.quote}/convert`, { data: {} })
    expect(draftConvert.status(), await draftConvert.text()).toBe(400)
    await expectJsonSuccess(await request.post(`/api/opportunities/${created.opportunity}/win`, { data: {} }))
    await expectJsonSuccess(await request.patch(`/api/tasks/${created.task}`, { data: { status: "completed" } }))
    await expectJsonSuccess(await request.patch(`/api/tickets/${created.ticket}`, { data: { status: "resolved" } }))
  } finally {
    await deleteIfPresent(request, "/api/quotes", created.quote)
    await deleteIfPresent(request, "/api/opportunities", created.opportunity)
    await deleteIfPresent(request, "/api/tasks", created.task)
    await deleteIfPresent(request, "/api/tickets", created.ticket)
    await deleteIfPresent(request, "/api/products", created.product)
    await deleteIfPresent(request, "/api/contacts", created.contact)
    await deleteIfPresent(request, "/api/accounts", created.account)
  }
})
