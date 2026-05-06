import { expect, test } from "@playwright/test"
import { expectNoTrialGate } from "./helpers"

test("regular user login reaches dashboard and is not trial-gated", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/dashboard/)
  await expect(page.getByRole("heading", { name: /bienvenido|dashboard/i })).toBeVisible()
  await expectNoTrialGate(page)
})

test("regular user is redirected away from admin area", async ({ page }) => {
  await page.goto("/admin")

  await expect(page).toHaveURL(/\/dashboard/)
  await expectNoTrialGate(page)
})

test.describe("platform admin", () => {
  test.use({ storageState: "tests/e2e/.auth/superadmin.json" })

  test("superadmin login reaches admin area and is not trial-gated", async ({ page }) => {
  await page.goto("/admin")

  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole("heading", { name: /admin|panel/i })).toBeVisible()
  await expectNoTrialGate(page)
  })
})
