import { expect, test, type Locator, type Page } from "@playwright/test"
import { expectJsonSuccess, expectNoTrialGate } from "./helpers"

async function selectFirstMatchingOption(page: Page, trigger: Locator, optionText: string) {
  await expect(trigger).toBeVisible()
  await trigger.click()
  const option = page.getByRole("option", { name: optionText, exact: true })
  await expect(option).toBeVisible()
  await option.click()
}

test("regular user can operate advanced daily modules from the UI", async ({ page, request }) => {
  test.setTimeout(240_000)

  const stamp = Date.now()
  const contactName = `E2E UI Cliente Avanzado ${stamp}`
  const productName = `E2E UI Servicio Avanzado ${stamp}`
  const opportunityName = `E2E UI Oportunidad ${stamp}`
  const quoteNote = `E2E UI Cotizacion ${stamp}`
  const invoiceNote = `E2E UI Factura ${stamp}`
  const campaignName = `E2E UI Campaña ${stamp}`
  const eventTitle = `E2E UI Evento ${stamp}`
  const workflowName = `E2E UI Workflow ${stamp}`

  await expectJsonSuccess(await request.post("/api/contacts", {
    data: {
      name: contactName,
      email: `ui.advanced.${stamp}@example.org`,
      phone: "+51999888777",
      lead_status: "warm",
      source: "e2e-ui",
    },
  }))

  await expectJsonSuccess(await request.post("/api/products", {
    data: {
      name: productName,
      sku: `UI-ADV-${stamp}`,
      unit_price: 140,
      cost_price: 60,
      stock_quantity: 20,
      is_service: true,
    },
  }))

  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/dashboard/)
  await expectNoTrialGate(page)
  await expect(page.getByText("Super Admin")).toHaveCount(0)

  await page.goto("/pipeline")
  await page.getByRole("button", { name: "Nueva Oportunidad" }).click()
  let dialog = page.getByRole("dialog", { name: "Nueva Oportunidad" })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Nombre *").fill(opportunityName)
  await dialog.getByLabel("Valor (S/)").fill("1800")
  await dialog.getByLabel("Probabilidad (%)").fill("40")
  await dialog.getByLabel("Fecha cierre esperada").fill("2026-06-30")
  await dialog.getByLabel("Notas").fill("Creada desde auditoria UI avanzada")
  const opportunityComboboxes = dialog.getByRole("combobox")
  await expect(opportunityComboboxes).toHaveCount(2)
  await selectFirstMatchingOption(page, opportunityComboboxes.nth(1), contactName)
  await dialog.getByRole("button", { name: "Crear" }).click()
  await expect(page.getByText(opportunityName)).toBeVisible()

  await page.goto("/quotes")
  await page.getByRole("button", { name: "Nueva Cotización" }).click()
  dialog = page.getByRole("dialog", { name: "Nueva Cotización" })
  await expect(dialog).toBeVisible()
  const quoteComboboxes = dialog.getByRole("combobox")
  await expect(quoteComboboxes).toHaveCount(3)
  await selectFirstMatchingOption(page, quoteComboboxes.nth(0), contactName)
  await dialog.getByPlaceholder("Descripción").fill(productName)
  await dialog.getByPlaceholder("Cant.").fill("2")
  await dialog.getByPlaceholder("Precio").fill("140")
  await dialog.getByLabel("Notas").fill(quoteNote)
  await dialog.getByRole("button", { name: "Crear Cotización" }).click()
  await expect(dialog).toBeHidden({ timeout: 30_000 })
  const quoteRow = page.getByRole("row").filter({ hasText: contactName }).filter({ hasText: "S/ 280.00" })
  await expect(quoteRow).toBeVisible()

  await page.goto("/invoicing/new")
  await expect(page.getByRole("heading", { name: "Nueva Factura" })).toBeVisible()
  const invoiceClient = page.getByRole("combobox")
  await expect(invoiceClient).toHaveCount(1)
  await selectFirstMatchingOption(page, invoiceClient, contactName)
  await page.getByPlaceholder("Descripción del producto/servicio").fill(productName)
  await page.getByLabel("Cantidad").fill("1")
  await page.getByLabel("Precio Unit.").fill("140")
  await page.getByPlaceholder("Notas adicionales para el cliente...").fill(invoiceNote)
  await page.getByRole("button", { name: "Crear Factura" }).click()
  await expect(page).toHaveURL(/\/invoicing$/, { timeout: 30_000 })
  const invoiceRow = page.getByRole("row").filter({ hasText: contactName })
  await expect(invoiceRow).toBeVisible()

  await page.goto("/campaigns")
  await page.getByRole("button", { name: "Nueva Campaña" }).click()
  dialog = page.getByRole("dialog", { name: "Nueva campaña" })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Nombre*").fill(campaignName)
  await dialog.getByLabel("Descripción").fill("Campaña creada desde auditoria UI")
  await dialog.getByLabel("Asunto").fill("Mensaje E2E")
  await dialog.getByLabel("Contenido").fill("Contenido de campaña E2E")
  await dialog.getByLabel("Presupuesto").fill("25")
  await dialog.getByRole("button", { name: "Crear" }).click()
  await expect(page.getByText(campaignName)).toBeVisible()

  await page.goto("/calendar")
  await page.getByRole("button", { name: "Nuevo Evento" }).click()
  dialog = page.getByRole("dialog", { name: "Nuevo Evento" })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Título").fill(eventTitle)
  await dialog.getByLabel("Ubicación / Link").fill("Google Meet")
  await dialog.getByLabel("Descripción").fill("Evento creado desde auditoria UI")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(eventTitle)).toBeVisible()

  await page.goto("/workflows")
  await page.getByRole("button", { name: "Nuevo Workflow" }).click()
  dialog = page.getByRole("dialog", { name: "Nuevo Workflow" })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel("Nombre").fill(workflowName)
  await dialog.getByLabel("Descripción").fill("Workflow creado desde auditoria UI")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(workflowName)).toBeVisible()
})
