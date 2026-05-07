import { expect, test, type Locator, type Page } from "@playwright/test"
import { appPages, expectNoTrialGate } from "./helpers"

async function fillByLabelOrIndex(dialog: Locator, label: string, index: number, value: string) {
  const byLabel = dialog.getByLabel(label, { exact: true })
  if (await byLabel.count()) {
    await byLabel.fill(value)
    return
  }

  await dialog.locator("input").nth(index).fill(value)
}

async function openDialog(page: Page, buttonName: string, dialogTitle: string) {
  await page.getByRole("button", { name: buttonName }).click()
  const dialog = page.getByRole("dialog", { name: dialogTitle })
  await expect(dialog).toBeVisible()
  return dialog
}

async function selectFirstMatchingOption(page: Page, trigger: Locator, optionText: string) {
  await expect(trigger).toBeVisible()
  await trigger.click()
  const option = page.getByRole("option", { name: optionText, exact: true })
  await expect(option).toBeVisible()
  await option.click()
}

test("real user logs in through the UI and operates the full CRM day", async ({ page }) => {
  test.setTimeout(420_000)

  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  const badResponses: string[] = []

  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) {
      consoleErrors.push(message.text())
    }
  })
  page.on("pageerror", (error) => pageErrors.push(error.message))
  page.on("response", (response) => {
    const status = response.status()
    if (status >= 500 || status === 429) badResponses.push(`${status} ${response.url()}`)
  })

  const stamp = Date.now()
  const accountName = `E2E Real Cuenta ${stamp}`
  const contactName = `E2E Real Contacto ${stamp}`
  const leadName = `E2E Real Lead ${stamp}`
  const productName = `E2E Real Producto ${stamp}`
  const opportunityName = `E2E Real Oportunidad ${stamp}`
  const taskTitle = `E2E Real Tarea ${stamp}`
  const ticketTitle = `E2E Real Ticket ${stamp}`
  const formName = `E2E Real Form ${stamp}`
  const webhookName = `E2E Real Webhook ${stamp}`
  const campaignName = `E2E Real Campaña ${stamp}`
  const eventTitle = `E2E Real Evento ${stamp}`
  const workflowName = `E2E Real Workflow ${stamp}`

  await page.context().clearCookies()
  await page.goto("/login")
  await page.getByPlaceholder("tu@email.com").fill(process.env.TEST_USER_EMAIL!)
  await page.getByPlaceholder("••••••••").fill(process.env.TEST_USER_PASSWORD!)
  await page.getByRole("button", { name: /Iniciar Sesión/i }).click()
  await page.waitForURL(/\/dashboard$/)
  await expect(page.getByText("E2E Usuario Real")).toBeVisible()
  await expect(page.getByText("Super Admin")).toHaveCount(0)
  await expectNoTrialGate(page)

  for (const path of appPages) {
    const response = await page.goto(path)
    expect(response?.status(), `${path} should load for a real user`).toBeLessThan(400)
    await page.waitForLoadState("networkidle").catch(() => undefined)
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { name: /404|No encontrado|Page not found/i })).toHaveCount(0)
    await expect(page.getByText("Super Admin")).toHaveCount(0)
    await expectNoTrialGate(page)
  }

  await page.goto("/accounts")
  let dialog = await openDialog(page, "Nueva Cuenta", "Nueva Cuenta")
  await fillByLabelOrIndex(dialog, "Nombre *", 0, accountName)
  await fillByLabelOrIndex(dialog, "RUC", 1, `20${String(stamp).slice(-9)}`)
  await fillByLabelOrIndex(dialog, "Telefono", 2, "+51999000111")
  await fillByLabelOrIndex(dialog, "Industria", 3, "Servicios")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(accountName)).toBeVisible()

  await page.goto("/contacts")
  dialog = await openDialog(page, "Nuevo Contacto", "Nuevo Contacto")
  await fillByLabelOrIndex(dialog, "Nombre Completo *", 0, contactName)
  await fillByLabelOrIndex(dialog, "Email", 1, `real.contact.${stamp}@example.org`)
  await fillByLabelOrIndex(dialog, "Teléfono *", 2, "+51999000222")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(contactName)).toBeVisible()

  await page.goto("/leads")
  dialog = await openDialog(page, "Nuevo Lead", "Nuevo Lead")
  await dialog.getByPlaceholder("Juan Pérez").fill(leadName)
  await dialog.getByPlaceholder("juan@ejemplo.com").fill(`real.lead.${stamp}@example.org`)
  await dialog.getByPlaceholder("+51 999...").fill("+51999000333")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(leadName)).toBeVisible()

  await page.goto("/products")
  dialog = await openDialog(page, "Nuevo Producto", "Nuevo producto")
  await fillByLabelOrIndex(dialog, "Nombre*", 0, productName)
  await fillByLabelOrIndex(dialog, "SKU", 1, `REAL-${stamp}`)
  await fillByLabelOrIndex(dialog, "Precio Venta", 2, "120")
  await fillByLabelOrIndex(dialog, "Precio Costo", 3, "80")
  await fillByLabelOrIndex(dialog, "Stock", 4, "8")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(productName)).toBeVisible()

  await page.goto("/inventory")
  await expect(page).toHaveURL(/\/products\?tab=inventory/)
  await expect(page.getByText(productName)).toBeVisible()

  await page.goto("/pipeline")
  dialog = await openDialog(page, "Nueva Oportunidad", "Nueva Oportunidad")
  await dialog.getByLabel("Nombre *").fill(opportunityName)
  await dialog.getByLabel("Valor (S/)").fill("1800")
  await dialog.getByLabel("Probabilidad (%)").fill("40")
  await dialog.getByLabel("Fecha cierre esperada").fill("2026-06-30")
  const opportunityComboboxes = dialog.getByRole("combobox")
  await expect(opportunityComboboxes).toHaveCount(2)
  await selectFirstMatchingOption(page, opportunityComboboxes.nth(1), contactName)
  await dialog.getByRole("button", { name: "Crear" }).click()
  await expect(page.getByText(opportunityName)).toBeVisible()

  await page.goto("/tasks")
  dialog = await openDialog(page, "Nueva Tarea", "Nueva Tarea")
  await dialog.getByPlaceholder("Ej. Llamar a cliente").fill(taskTitle)
  await dialog.getByPlaceholder("Detalles adicionales...").fill(`Seguimiento de ${contactName}`)
  await dialog.getByRole("button", { name: "Guardar Tarea" }).click()
  await expect(page.getByText(taskTitle)).toBeVisible()

  await page.goto("/tickets")
  dialog = await openDialog(page, "Nuevo Ticket", "Nuevo Ticket")
  await dialog.getByPlaceholder("Ej. Error al procesar pago").fill(ticketTitle)
  await dialog.getByPlaceholder("Detalle del caso...").fill(`Caso asociado a ${accountName}`)
  await dialog.getByRole("button", { name: "Guardar ticket" }).click()
  await expect(page.getByText(ticketTitle)).toBeVisible()

  await page.goto("/quotes")
  dialog = await openDialog(page, "Nueva Cotización", "Nueva Cotización")
  const quoteComboboxes = dialog.getByRole("combobox")
  await expect(quoteComboboxes).toHaveCount(3)
  await selectFirstMatchingOption(page, quoteComboboxes.nth(0), contactName)
  await dialog.getByPlaceholder("Descripción").fill(productName)
  await dialog.getByPlaceholder("Cant.").fill("1")
  await dialog.getByPlaceholder("Precio").fill("120")
  await dialog.getByRole("button", { name: "Crear Cotización" }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })

  await page.goto("/invoicing/new")
  await expect(page.getByRole("heading", { name: "Nueva Factura" })).toBeVisible()
  await selectFirstMatchingOption(page, page.getByRole("combobox"), contactName)
  await page.getByPlaceholder("Descripción del producto/servicio").fill(productName)
  await page.getByLabel("Cantidad").fill("1")
  await page.getByLabel("Precio Unit.").fill("120")
  await page.getByRole("button", { name: "Crear Factura" }).click()
  await expect(page).toHaveURL(/\/invoicing$/, { timeout: 30_000 })

  await page.goto("/campaigns")
  dialog = await openDialog(page, "Nueva Campaña", "Nueva campaña")
  await dialog.getByLabel("Nombre*").fill(campaignName)
  await dialog.getByLabel("Asunto").fill("Mensaje E2E real")
  await dialog.getByLabel("Contenido").fill("Contenido de campaña E2E real")
  await dialog.getByRole("button", { name: "Crear" }).click()
  await expect(page.getByText(campaignName)).toBeVisible()

  await page.goto("/calendar")
  dialog = await openDialog(page, "Nuevo Evento", "Nuevo Evento")
  await dialog.getByLabel("Título").fill(eventTitle)
  await dialog.getByLabel("Ubicación / Link").fill("Google Meet")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(eventTitle)).toBeVisible()

  await page.goto("/forms")
  dialog = await openDialog(page, "Nuevo Formulario", "Nuevo Formulario")
  await dialog.getByPlaceholder("Ej: Solicitar demo").fill(formName)
  await dialog.getByPlaceholder("Descripción que aparecerá en el formulario").fill("Captura diaria de leads")
  await dialog.getByRole("button", { name: "Crear formulario" }).click()
  await expect(page.getByText(formName)).toBeVisible()

  await page.goto("/settings/webhooks")
  const firstWebhookButton = page.getByRole("button", { name: "Crear primer webhook" })
  if (await firstWebhookButton.count()) {
    await firstWebhookButton.click()
  } else {
    await page.getByRole("button", { name: "Nuevo Webhook" }).click()
  }
  dialog = page.getByRole("dialog", { name: "Crear Webhook" })
  await expect(dialog).toBeVisible()
  await page.locator('input[placeholder^="Mi"]').fill(webhookName)
  await page.locator('input[placeholder^="https://mi-servidor"]').fill(`https://example.org/real-webhook-${stamp}`)
  await dialog.getByRole("button", { name: "Crear Webhook" }).click()
  await expect(page.getByText(webhookName)).toBeVisible()

  await page.goto("/workflows")
  dialog = await openDialog(page, "Nuevo Workflow", "Nuevo Workflow")
  await dialog.getByLabel("Nombre").fill(workflowName)
  await dialog.getByLabel("Descripción").fill("Workflow creado desde sesion real UI")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(workflowName)).toBeVisible()

  expect(consoleErrors, "console errors during real user UI session").toEqual([])
  expect(pageErrors, "page errors during real user UI session").toEqual([])
  expect(badResponses, "5xx/429 responses during real user UI session").toEqual([])
})
