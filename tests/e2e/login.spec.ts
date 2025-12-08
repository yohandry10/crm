import { test, expect } from "@playwright/test"

const baseURL = process.env.BASE_URL || "http://localhost:3000"
const email = process.env.TEST_USER_EMAIL || "test@example.com"
const password = process.env.TEST_USER_PASSWORD || "password123"

test("login y acceso a dashboard", async ({ page }) => {
  await page.goto(`${baseURL}/login`)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')

  await page.waitForURL(`${baseURL}/dashboard`, { timeout: 15000 })
  await expect(page).toHaveURL(/dashboard/)
  await expect(page.getByText(/Dashboard CRM AI/i)).toBeVisible()
})
