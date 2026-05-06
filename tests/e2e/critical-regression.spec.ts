import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { expectJsonSuccess, expectNoTrialGate } from "./helpers"

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var ${name}`)
  return value
}

function adminClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function newSuperAdminContext(baseURL: string | undefined) {
  return playwrightRequest.newContext({
    baseURL,
    storageState: "tests/e2e/.auth/superadmin.json",
  })
}

async function deleteAuthUserByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) throw error
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase())
  if (!user) return

  await admin.from("profiles").delete().eq("id", user.id)
  await admin.auth.admin.deleteUser(user.id)
}

async function getCurrentOrganizationId(request: APIRequestContext) {
  const profile = await expectJsonSuccess(await request.get("/api/profile"))
  const organizationId = profile.data.current_organization_id
  expect(organizationId).toBeTruthy()
  return organizationId as string
}

async function createInvoiceForPayment(request: APIRequestContext, stamp: number) {
  const contact = await expectJsonSuccess(await request.post("/api/contacts", {
    data: {
      name: `Critical Payment Contact ${stamp}`,
      email: `critical.payment.${stamp}@example.org`,
      phone: "+51999002020",
      lead_status: "warm",
      source: "critical-e2e",
    },
  }))

  const invoice = await expectJsonSuccess(await request.post("/api/invoices", {
    data: {
      contact_id: contact.data.id,
      due_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      notes: `Critical payment invoice ${stamp}`,
      items: [{ description: "Critical E2E service", quantity: 1, unit_price: 100, tax_rate: 0 }],
    },
  }))

  return { contactId: contact.data.id as string, invoiceId: invoice.data.id as string }
}

async function assertLoginSurface(page: Page) {
  await page.goto("/login?redirect=/dashboard")
  await page.getByPlaceholder("tu@email.com").fill(requireEnv("TEST_USER_EMAIL"))
  await page.getByPlaceholder("••••••••").fill(requireEnv("TEST_USER_PASSWORD"))
  await page.getByRole("button", { name: /Iniciar/i }).click()
  await page.waitForURL(/\/dashboard$/)
  await expect(page.getByRole("heading", { name: /Bienvenido/i })).toBeVisible()
  await expectNoTrialGate(page)
}

test("critical auth path covers login and strong signup without tenant self-provisioning", async ({ browser }) => {
  test.setTimeout(120_000)

  const admin = adminClient()
  const email = `critical.signup.${Date.now()}@gmail.com`
  const password = "CriticalSignup1234"
  await deleteAuthUserByEmail(admin, email)

  const loginContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const loginPage = await loginContext.newPage()
  await assertLoginSurface(loginPage)
  await loginContext.close()

  const signupContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await signupContext.newPage()

  try {
    await page.goto("/signup")
    await page.getByLabel("Nombre completo").fill("Critical Signup User")
    await page.getByLabel("Email").fill(email)
    await page.getByLabel("Empresa (opcional)").fill("Should Not Auto Tenant")
    await page.getByLabel("Contraseña", { exact: true }).fill(password)
    await page.getByLabel("Confirmar contraseña").fill(password)
    await page.getByRole("button", { name: /Crear Cuenta Gratis/i }).click()

    const successMessage = page.getByText("¡Cuenta Creada!")
    const errorMessage = page.locator(".text-red-600").first()

    await expect
      .poll(async () => (await successMessage.count()) > 0 || (await errorMessage.count()) > 0, {
        timeout: 30_000,
      })
      .toBe(true)

    const { data, error } = await admin.auth.admin.listUsers()
    expect(error).toBeFalsy()
    const createdUser = data.users.find((candidate) => candidate.email?.toLowerCase() === email)

    if (await successMessage.count()) {
      expect(createdUser?.id).toBeTruthy()

      const { data: profile } = await admin
        .from("profiles")
        .select("id,current_organization_id")
        .eq("id", createdUser!.id)
        .maybeSingle()

      if (profile) {
        expect(profile.current_organization_id).toBeFalsy()
      }

      const { data: memberships, error: membershipError } = await admin
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", createdUser!.id)

      expect(membershipError).toBeFalsy()
      expect(memberships || []).toHaveLength(0)
    } else {
      await expect(errorMessage).toContainText(/rate limit|already registered|invalid|email/i)
      expect(createdUser).toBeFalsy()
    }
  } finally {
    await signupContext.close()
    await deleteAuthUserByEmail(admin, email)
  }
})

test("critical payments flow is idempotent, blocks overpayment, logs billing, and supports admin activation", async ({ request, baseURL }) => {
  test.setTimeout(180_000)

  const stamp = Date.now()
  const organizationId = await getCurrentOrganizationId(request)
  const admin = await newSuperAdminContext(baseURL)
  const { contactId, invoiceId } = await createInvoiceForPayment(request, stamp)
  const idempotencyKey = `critical-payment-${stamp}`

  try {
    const firstPayment = await expectJsonSuccess(await request.post("/api/payments", {
      headers: { "idempotency-key": idempotencyKey },
      data: {
        invoice_id: invoiceId,
        amount: 40,
        gateway: "manual",
        payment_method: "manual",
        notes: "critical e2e partial payment",
      },
    }))

    const secondPayment = await expectJsonSuccess(await request.post("/api/payments", {
      headers: { "idempotency-key": idempotencyKey },
      data: {
        invoice_id: invoiceId,
        amount: 40,
        gateway: "manual",
        payment_method: "manual",
        notes: "critical e2e partial payment duplicate",
      },
    }))

    expect(secondPayment.cached).toBe(true)
    expect(secondPayment.data.payment_id).toBe(firstPayment.data.payment_id)

    const overpayment = await request.post("/api/payments", {
      headers: { "idempotency-key": `critical-overpay-${stamp}` },
      data: {
        invoice_id: invoiceId,
        amount: 5000,
        gateway: "manual",
        payment_method: "manual",
      },
    })
    expect([400, 422], await overpayment.text()).toContain(overpayment.status())

    const audit = await expectJsonSuccess(await admin.get("/api/admin/audit-logs?category=billing&action=PAYMENT_RECORDED&limit=20"))
    expect(JSON.stringify(audit.data)).toContain(invoiceId)
    expect(JSON.stringify(audit.data)).not.toContain(idempotencyKey)

    const checkout = await request.post("/api/subscriptions/checkout", {
      data: { plan: "professional", billingPeriod: "monthly" },
    })
    expect(checkout.status(), await checkout.text()).toBe(202)
    const checkoutJson = await checkout.json()
    expect(checkoutJson.success).toBe(true)
    expect(checkoutJson.pendingPayment).toBe(true)
    expect(checkoutJson.data.paymentReference).toBeTruthy()

    const activation = await expectJsonSuccess(await admin.post("/api/admin/subscriptions/activate", {
      data: {
        organizationId,
        plan: "professional",
        billingPeriod: "monthly",
        paymentReference: checkoutJson.data.paymentReference,
      },
    }))
    expect(activation.success).toBe(true)
  } finally {
    await admin.dispose()
    await request.delete(`/api/invoices/${invoiceId}`)
    await request.delete(`/api/contacts/${contactId}`)
  }
})

test("critical workflow path creates, queues, tracks, and exposes admin traceability", async ({ browser, request, baseURL }) => {
  test.setTimeout(180_000)

  const stamp = Date.now()
  const admin = await newSuperAdminContext(baseURL)
  const adminBrowserContext = await browser.newContext({ storageState: "tests/e2e/.auth/superadmin.json" })
  const adminPage = await adminBrowserContext.newPage()
  const contact = await expectJsonSuccess(await request.post("/api/contacts", {
    data: {
      name: `Critical Workflow Contact ${stamp}`,
      email: `critical.workflow.${stamp}@example.org`,
      phone: "+51999003030",
      lead_status: "warm",
      source: "critical-e2e",
    },
  }))

  let workflowId: string | undefined
  let blockedWorkflowId: string | undefined
  try {
    const workflow = await expectJsonSuccess(await request.post("/api/workflows", {
      data: {
        name: `Critical Workflow ${stamp}`,
        description: "Critical E2E queued workflow",
        trigger_type: "contact.created",
        trigger_conditions: { conditions: [] },
        actions: [],
        is_active: true,
      },
    }))
    workflowId = workflow.data.id

    const blockedWorkflow = await expectJsonSuccess(await request.post("/api/workflows", {
      data: {
        name: `Critical Blocked Workflow ${stamp}`,
        description: "Critical E2E condition mismatch",
        trigger_type: "contact.created",
        trigger_conditions: { conditions: [{ field: "lead_status", operator: "==", value: "hot" }] },
        actions: [],
        is_active: true,
      },
    }))
    blockedWorkflowId = blockedWorkflow.data.id

    const blockedExecution = await request.post("/api/workflows/execute", {
      data: {
        workflow_id: blockedWorkflow.data.id,
        contact_id: contact.data.id,
        event_data: { lead_status: "cold" },
      },
    })
    expect(blockedExecution.status(), await blockedExecution.text()).toBe(400)

    const execution = await expectJsonSuccess(await request.post("/api/workflows/execute", {
      data: {
        workflow_id: workflowId,
        contact_id: contact.data.id,
        event_data: { lead_status: "warm" },
        manual_trigger: true,
        priority: "high",
      },
    }))
    expect(execution.data.status).toBe("queued")
    expect(execution.data.jobId).toBeTruthy()

    const jobStatus = await expectJsonSuccess(await request.get(`/api/jobs/${execution.data.jobId}`))
    expect(["waiting", "active", "completed", "delayed", "prioritized"]).toContain(jobStatus.data.state)
    expect(jobStatus.data.jobData.workflowId).toBe(workflowId)
    expect(jobStatus.data.jobData.contactId).toBe(contact.data.id)

    await adminPage.goto("/admin/queues")
    await expect(adminPage).toHaveURL(/\/admin\/queues/)
    await expect(adminPage.getByText("Super Admin", { exact: true })).toBeVisible()

    const adminAudit = await expectJsonSuccess(await admin.get("/api/admin/audit-logs?action=ADMIN_VIEW_AUDIT_LOGS&limit=10"))
    expect(adminAudit.success).toBe(true)
  } finally {
    await admin.dispose()
    await adminBrowserContext.close()
    if (workflowId) await request.delete(`/api/workflows/${workflowId}`)
    if (blockedWorkflowId) await request.delete(`/api/workflows/${blockedWorkflowId}`)
    await request.delete(`/api/contacts/${contact.data.id}`)
  }
})

test("critical edge regressions block unsafe uploads and malformed requests", async ({ request }) => {
  test.setTimeout(90_000)

  const noMultipart = await request.post("/api/upload", {
    data: { bucket: "organization-assets" },
  })
  expect([400, 415], await noMultipart.text()).toContain(noMultipart.status())

  const svgUpload = await request.post("/api/upload", {
    multipart: {
      bucket: "organization-assets",
      file: {
        name: "active.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg><script>alert(1)</script></svg>"),
      },
    },
  })
  expect(svgUpload.status(), await svgUpload.text()).toBe(400)

  const traversalUpload = await request.post("/api/upload", {
    multipart: {
      bucket: "organization-assets",
      path: "../other-tenant",
      file: {
        name: "avatar.png",
        mimeType: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      },
    },
  })
  expect(traversalUpload.status(), await traversalUpload.text()).toBe(400)

  const unknownJob = await request.get("/api/jobs/unknown-critical-job")
  expect(unknownJob.status(), await unknownJob.text()).toBe(404)
})
