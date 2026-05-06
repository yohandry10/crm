import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test"
import { expectJsonSuccess } from "./helpers"

type SeedRecords = {
  contactId: string
  productId: string
  opportunityId: string
  quoteId: string
  invoiceId: string
  taskId: string
  ticketId: string
  workflowId: string
}

async function newRoleContext(baseURL: string | undefined, role: string) {
  return playwrightRequest.newContext({
    baseURL,
    storageState: `tests/e2e/.auth/${role}.json`,
  })
}

async function seedRecords(owner: APIRequestContext): Promise<SeedRecords> {
  const stamp = Date.now()

  const contact = await expectJsonSuccess(await owner.post("/api/contacts", {
    data: {
      name: `Mutation Guard Contact ${stamp}`,
      email: `mutation.guard.${stamp}@example.org`,
      phone: "+51999123456",
      lead_status: "warm",
      source: "e2e-roles",
    },
  }))

  const product = await expectJsonSuccess(await owner.post("/api/products", {
    data: {
      name: `Mutation Guard Product ${stamp}`,
      sku: `MUT-${stamp}`,
      unit_price: 120,
      cost_price: 50,
      stock_quantity: 10,
    },
  }))

  const opportunity = await expectJsonSuccess(await owner.post("/api/opportunities", {
    data: {
      name: `Mutation Guard Opportunity ${stamp}`,
      contact_id: contact.data.id,
      stage_id: "prospecting",
      expected_revenue: 1200,
      probability: 20,
    },
  }))

  const invoice = await expectJsonSuccess(await owner.post("/api/invoices", {
    data: {
      contact_id: contact.data.id,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: `Mutation Guard Invoice ${stamp}`,
      items: [{ description: "Servicio de auditoria", quantity: 1, unit_price: 120, tax_rate: 0.18 }],
    },
  }))

  const quote = await expectJsonSuccess(await owner.post("/api/quotes", {
    data: {
      contact_id: contact.data.id,
      opportunity_id: opportunity.data.id,
      notes: `Mutation Guard Quote ${stamp}`,
      items: [{ description: "Servicio cotizado", quantity: 1, unit_price: 120 }],
    },
  }))

  const task = await expectJsonSuccess(await owner.post("/api/tasks", {
    data: {
      title: `Mutation Guard Task ${stamp}`,
      description: "Task for mutation guard",
      status: "pending",
      priority: "medium",
      contact_id: contact.data.id,
    },
  }))

  const ticket = await expectJsonSuccess(await owner.post("/api/tickets", {
    data: {
      title: `Mutation Guard Ticket ${stamp}`,
      description: "Ticket for mutation guard",
      status: "open",
      priority: "medium",
      contact_id: contact.data.id,
    },
  }))

  const workflow = await expectJsonSuccess(await owner.post("/api/workflows", {
    data: {
      name: `Mutation Guard Workflow ${stamp}`,
      description: "Workflow for mutation guard",
      trigger_type: "contact.created",
      trigger_conditions: {},
      actions: [],
      is_active: true,
    },
  }))

  return {
    contactId: contact.data.id,
    productId: product.data.id,
    opportunityId: opportunity.data.id,
    quoteId: quote.data.id,
    invoiceId: invoice.data.id,
    taskId: task.data.id,
    ticketId: ticket.data.id,
    workflowId: workflow.data.id,
  }
}

async function expectForbidden(responsePromise: Promise<any>, label: string) {
  const response = await responsePromise
  expect(response.status(), `${label}: ${await response.text()}`).toBe(403)
}

test("readonly and limited roles cannot mutate protected modules through the API", async ({ baseURL }) => {
  test.setTimeout(180_000)

  const owner = await newRoleContext(baseURL, "owner")
  const viewer = await newRoleContext(baseURL, "viewer")
  const member = await newRoleContext(baseURL, "member")
  const manager = await newRoleContext(baseURL, "manager")

  try {
    const seed = await seedRecords(owner)

    await expectForbidden(viewer.put(`/api/contacts/${seed.contactId}`, { data: { name: "Viewer edit" } }), "viewer contact update")
    await expectForbidden(viewer.delete(`/api/contacts/${seed.contactId}`), "viewer contact delete")
    await expectForbidden(viewer.put(`/api/products/${seed.productId}`, { data: { name: "Viewer product edit" } }), "viewer product update")
    await expectForbidden(viewer.delete(`/api/products/${seed.productId}`), "viewer product delete")
    await expectForbidden(viewer.patch(`/api/opportunities/${seed.opportunityId}`, { data: { name: "Viewer opportunity edit" } }), "viewer opportunity update")
    await expectForbidden(viewer.delete(`/api/opportunities/${seed.opportunityId}`), "viewer opportunity delete")
    await expectForbidden(viewer.patch(`/api/quotes/${seed.quoteId}`, { data: { status: "sent" } }), "viewer quote update")
    await expectForbidden(viewer.delete(`/api/quotes/${seed.quoteId}`), "viewer quote delete")
    await expectForbidden(viewer.post(`/api/quotes/${seed.quoteId}/convert`, { data: {} }), "viewer quote convert")
    await expectForbidden(viewer.patch(`/api/invoices/${seed.invoiceId}`, { data: { status: "sent" } }), "viewer invoice update")
    await expectForbidden(viewer.delete(`/api/invoices/${seed.invoiceId}`), "viewer invoice delete")
    await expectForbidden(viewer.patch(`/api/tasks/${seed.taskId}`, { data: { status: "completed" } }), "viewer task update")
    await expectForbidden(viewer.delete(`/api/tasks/${seed.taskId}`), "viewer task delete")
    await expectForbidden(viewer.patch(`/api/tickets/${seed.ticketId}`, { data: { status: "closed" } }), "viewer ticket update")
    await expectForbidden(viewer.delete(`/api/tickets/${seed.ticketId}`), "viewer ticket delete")
    await expectForbidden(viewer.put(`/api/workflows/${seed.workflowId}`, { data: { name: "Viewer workflow edit" } }), "viewer workflow update")
    await expectForbidden(viewer.delete(`/api/workflows/${seed.workflowId}`), "viewer workflow delete")

    await expectForbidden(member.patch(`/api/invoices/${seed.invoiceId}`, { data: { status: "sent" } }), "member invoice update")
    await expectForbidden(member.put(`/api/products/${seed.productId}`, { data: { name: "Member product edit" } }), "member product update")
    await expectForbidden(member.patch(`/api/tickets/${seed.ticketId}`, { data: { status: "closed" } }), "member ticket update")
    await expectForbidden(member.put(`/api/workflows/${seed.workflowId}`, { data: { name: "Member workflow edit" } }), "member workflow update")
    await expectForbidden(member.put(`/api/contacts/${seed.contactId}`, { data: { name: "Member edits owner contact" } }), "member cannot update another user's contact")
    await expectForbidden(member.patch(`/api/opportunities/${seed.opportunityId}`, { data: { name: "Member edits owner opportunity" } }), "member cannot update another user's opportunity")
    await expectForbidden(member.patch(`/api/quotes/${seed.quoteId}`, { data: { status: "sent" } }), "member cannot update another user's quote")
    await expectForbidden(member.patch(`/api/tasks/${seed.taskId}`, { data: { status: "completed" } }), "member cannot update another user's task")
    await expectForbidden(member.post("/api/payments", {
      data: {
        invoice_id: seed.invoiceId,
        amount: 1,
        gateway: "manual",
        payment_method: "manual",
      },
      headers: { "idempotency-key": `member-denied-${Date.now()}` },
    }), "member payment create")

    await expectForbidden(manager.put(`/api/products/${seed.productId}`, {
      data: { name: `Manager updated product ${Date.now()}` },
    }), "manager cannot update another user's product")

    const managerOwnProduct = await expectJsonSuccess(await manager.post("/api/products", {
      data: {
        name: `Manager Own Product ${Date.now()}`,
        sku: `MANAGER-OWN-${Date.now()}`,
        unit_price: 35,
        cost_price: 12,
        stock_quantity: 4,
      },
    }))

    const managerOwnProductUpdate = await manager.put(`/api/products/${managerOwnProduct.data.id}`, {
      data: { name: `Manager updated own product ${Date.now()}` },
    })
    expect(managerOwnProductUpdate.ok(), await managerOwnProductUpdate.text()).toBeTruthy()

    const memberOwnContact = await expectJsonSuccess(await member.post("/api/contacts", {
      data: {
        name: `Member Own Contact ${Date.now()}`,
        email: `member.own.${Date.now()}@example.org`,
        phone: "+51999123457",
        lead_status: "warm",
        source: "e2e-roles",
      },
    }))

    const memberOwnContactUpdate = await member.put(`/api/contacts/${memberOwnContact.data.id}`, {
      data: { name: `Member updated own contact ${Date.now()}` },
    })
    expect(memberOwnContactUpdate.ok(), await memberOwnContactUpdate.text()).toBeTruthy()

    await expectForbidden(manager.delete(`/api/products/${seed.productId}`), "manager product delete")

    const managerPayment = await manager.post("/api/payments", {
      data: {
        invoice_id: seed.invoiceId,
        amount: 1,
        gateway: "manual",
        payment_method: "manual",
      },
      headers: { "idempotency-key": `manager-payment-${Date.now()}` },
    })
    expect(managerPayment.ok(), await managerPayment.text()).toBeTruthy()
  } finally {
    await owner.dispose()
    await viewer.dispose()
    await member.dispose()
    await manager.dispose()
  }
})
