import { test, expect } from "@playwright/test"

const baseURL = process.env.BASE_URL || "http://localhost:3000"
const email = process.env.TEST_USER_EMAIL || "test@example.com"
const password = process.env.TEST_USER_PASSWORD || "password123"

test.beforeEach(async ({ page }) => {
  await page.goto(`${baseURL}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/)
})

test("crear cuenta y verla en el listado", async ({ page }) => {
  await page.goto(`${baseURL}/accounts`)
  await page.click('text=Nueva cuenta')
  await page.fill('input[placeholder="Nombre"]', 'Cuenta Playwright')
  await page.fill('input[placeholder="RUC"]', '12345678901')
  await page.click('text=Guardar')

  await expect(page.getByText('Cuenta Playwright')).toBeVisible({ timeout: 10000 })
})
