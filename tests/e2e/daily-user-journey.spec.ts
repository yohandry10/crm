import { expect, test, type Locator, type Page } from "@playwright/test"
import { expectNoTrialGate } from "./helpers"

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

test("regular user can complete a realistic daily CRM workflow", async ({ page }) => {
  test.setTimeout(180_000)

  const stamp = Date.now()
  const accountName = `E2E Cuenta Dia ${stamp}`
  const contactName = `E2E Contacto Dia ${stamp}`
  const leadName = `E2E Lead Dia ${stamp}`
  const productName = `E2E Producto Dia ${stamp}`
  const taskTitle = `E2E Tarea Dia ${stamp}`
  const ticketTitle = `E2E Ticket Dia ${stamp}`
  const formName = `E2E Form Dia ${stamp}`
  const webhookName = `E2E Webhook Dia ${stamp}`
  const uniqueRuc = `20${String(stamp).slice(-9)}`

  await page.goto("/dashboard")
  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByText("E2E Usuario Real")).toBeVisible()
  await expect(page.getByText("Super Admin")).toHaveCount(0)
  await expect(page.getByRole("link", { name: /admin/i })).toHaveCount(0)
  await expectNoTrialGate(page)

  await page.goto("/accounts")
  let dialog = await openDialog(page, "Nueva Cuenta", "Nueva Cuenta")
  await fillByLabelOrIndex(dialog, "Nombre *", 0, accountName)
  await fillByLabelOrIndex(dialog, "RUC", 1, uniqueRuc)
  await fillByLabelOrIndex(dialog, "Telefono", 2, "+51999000111")
  await fillByLabelOrIndex(dialog, "Industria", 3, "Servicios")
  await fillByLabelOrIndex(dialog, "Website", 4, "https://example.org")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(accountName)).toBeVisible()

  await page.goto("/contacts")
  dialog = await openDialog(page, "Nuevo Contacto", "Nuevo Contacto")
  await fillByLabelOrIndex(dialog, "Nombre Completo *", 0, contactName)
  await fillByLabelOrIndex(dialog, "Email", 1, `contacto.${stamp}@example.org`)
  await fillByLabelOrIndex(dialog, "Teléfono *", 2, "+51999000222")
  await fillByLabelOrIndex(dialog, "Empresa", 4, accountName)
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(contactName)).toBeVisible()

  await page.goto("/leads")
  dialog = await openDialog(page, "Nuevo Lead", "Nuevo Lead")
  await dialog.getByPlaceholder("Juan Pérez").fill(leadName)
  await dialog.getByPlaceholder("juan@ejemplo.com").fill(`lead.${stamp}@example.org`)
  await dialog.getByPlaceholder("+51 999...").fill("+51999000333")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(leadName)).toBeVisible()

  await page.goto("/products")
  dialog = await openDialog(page, "Nuevo Producto", "Nuevo producto")
  await fillByLabelOrIndex(dialog, "Nombre*", 0, productName)
  await fillByLabelOrIndex(dialog, "SKU", 1, `E2E-SKU-${stamp}`)
  await fillByLabelOrIndex(dialog, "Precio Venta", 2, "120")
  await fillByLabelOrIndex(dialog, "Precio Costo", 3, "80")
  await fillByLabelOrIndex(dialog, "Stock", 4, "8")
  await dialog.getByRole("button", { name: "Guardar" }).click()
  await expect(page.getByText(productName)).toBeVisible()

  await page.goto("/inventory")
  await expect(page).toHaveURL(/\/products\?tab=inventory/)
  await expect(page.getByText(productName)).toBeVisible()

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
  await page.locator('input[placeholder^="https://mi-servidor"]').fill(`https://example.org/webhook-${stamp}`)
  await expect(dialog.getByRole("checkbox", { name: "Contacto creado" })).toHaveAttribute("aria-checked", "true")
  await dialog.getByRole("button", { name: "Crear Webhook" }).click()
  await expect(page.getByText(webhookName)).toBeVisible()
})
