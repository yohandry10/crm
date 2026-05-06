import { expect, test } from "@playwright/test"
import { expectNoTrialGate } from "./helpers"

test("superadmin login reaches admin area and is not trial-gated", async ({ page }) => {
  await page.goto("/admin")

  await expect(page).toHaveURL(/\/admin/)
  await expect(page.getByRole("heading", { name: /admin|panel/i })).toBeVisible()
  await expectNoTrialGate(page)
})
