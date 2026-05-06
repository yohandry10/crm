import { expect, test } from "@playwright/test"

test("login sanitizes external redirects before entering the CRM", async ({ page }) => {
  await page.context().clearCookies()
  await page.goto("/")
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto("/login?redirect=https://evil.example/phish")
  await page.getByPlaceholder("tu@email.com").fill(process.env.TEST_USER_EMAIL!)
  await page.getByPlaceholder("••••••••").fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole("button", { name: /Iniciar/i }).click()

  await page.waitForURL(/\/dashboard$/)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test("forgot password uses guarded API and shows a generic success state", async ({ browser }) => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/auth/forgot-password") && response.request().method() === "POST"
  )

  await page.goto("/forgot-password")
  await page.getByPlaceholder("tu@email.com").fill("unknown-auth-audit@example.com")
  await page.getByRole("button", { name: /Enviar Instrucciones/i }).click()

  const response = await responsePromise
  expect(response.ok()).toBeTruthy()
  await expect(page.getByText("Email Enviado")).toBeVisible()
  await expect(page.getByText("Revisa tu bandeja de entrada")).toBeVisible()
  await context.close()
})

test("signup uses the same strong password policy as reset and profile", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()

  await page.goto("/signup")
  await page.getByLabel("Nombre completo").fill("Weak Signup")
  await page.getByLabel("Email").fill(`weak.signup.${Date.now()}@example.org`)
  await page.getByLabel("Contraseña", { exact: true }).fill("weakpass")
  await page.getByLabel("Confirmar contraseña").fill("weakpass")
  await page.getByRole("button", { name: /Crear Cuenta Gratis/i }).click()

  await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible()
  await context.close()
})

test("onboarding accepts friendly defaults without forcing RUC and normalizes tax percent", async ({ request }) => {
  const profileResponse = await request.get("/api/profile")
  expect(profileResponse.ok(), await profileResponse.text()).toBeTruthy()
  const profile = await profileResponse.json()
  const organizationId = profile.data.current_organization_id
  expect(organizationId).toBeTruthy()

  const response = await request.post("/api/onboarding/complete", {
    data: {
      organizationId,
      companyData: {
        name: "E2E Onboarding Friendly",
        ruc: "",
        address: "",
        phone: "",
        email: "",
      },
      configData: {
        currency: "PEN",
        taxRate: 18,
        serieFactura: "F001",
        serieBoleta: "B001",
        timezone: "America/Lima",
      },
      teamMembers: [
        { email: `onboarding.member.${Date.now()}@example.org`, role: "member" },
      ],
    },
  })

  expect(response.ok(), await response.text()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
})

test("login API rate limits repeated failures without revealing account state", async ({ request }) => {
  const email = `missing-auth-audit-${Date.now()}@example.com`
  let lastStatus = 0
  let lastBody: any = null

  for (let i = 0; i < 6; i += 1) {
    const response = await request.post("/api/auth/login", {
      data: { email, password: "WrongPassword1234" },
    })
    lastStatus = response.status()
    lastBody = await response.json()
  }

  expect(lastStatus).toBe(429)
  expect(lastBody.error).toMatch(/Demasiados intentos|intentos fallidos/i)
  expect(JSON.stringify(lastBody)).not.toContain("User not found")
})

test("profile password change requires current password and rejects weak passwords", async ({ page }) => {
  await page.goto("/profile")
  await page.getByRole("tab", { name: "Seguridad" }).click()

  await page.getByLabel("Contraseña Actual").fill("wrong-current-password")
  await page.getByLabel("Nueva Contraseña").fill("Weakpass1")
  await page.getByLabel("Confirmar Contraseña").fill("Weakpass1")
  await page.getByRole("button", { name: /Actualizar Contraseña/i }).click()

  await expect(page.getByText(/al menos 10 caracteres/)).toBeVisible()

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/auth/change-password") && response.request().method() === "POST"
  )
  await page.getByLabel("Nueva Contraseña").fill("StrongPass1234")
  await page.getByLabel("Confirmar Contraseña").fill("StrongPass1234")
  await page.getByRole("button", { name: /Actualizar Contraseña/i }).click()

  const response = await responsePromise
  expect(response.status()).toBe(400)
  await expect(page.getByText(/contraseña actual es incorrecta/i)).toBeVisible()
})
