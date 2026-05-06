import { expect, test } from "@playwright/test"
import { adminApiGetRoutes, adminPages, expectNoTrialGate } from "./helpers"

test.describe("platform admin surfaces", () => {
  test.use({ storageState: "tests/e2e/.auth/superadmin.json" })

  for (const path of adminPages) {
    test(`${path} renders for platform admin`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text())
      })

      const response = await page.goto(path)
      expect(response?.status(), `${path} should load`).toBeLessThan(400)
      await page.waitForLoadState("networkidle").catch(() => undefined)

      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.locator("body")).not.toContainText("404")
      await expectNoTrialGate(page)
      expect(consoleErrors.filter((error) => !error.includes("favicon")), consoleErrors.join("\n")).toEqual([])
    })
  }

  for (const path of adminApiGetRoutes) {
    test(`GET ${path} returns a successful admin response`, async ({ request }) => {
      const response = await request.get(path)
      expect(response.status(), await response.text()).toBe(200)
    })
  }
})
