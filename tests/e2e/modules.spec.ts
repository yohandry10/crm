import { expect, test } from "@playwright/test"
import { appPages, expectNoTrialGate } from "./helpers"

test.describe("authenticated module surfaces", () => {
  for (const path of appPages) {
    test(`${path} renders without auth redirect, 404, or trial gate`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text())
      })

      const response = await page.goto(path)
      expect(response?.status(), `${path} should load`).toBeLessThan(400)
      await page.waitForLoadState("networkidle").catch(() => undefined)

      await expect(page).not.toHaveURL(/\/login/)
      await expect(page.getByRole("heading", { name: /404|No encontrado|Page not found/i })).toHaveCount(0)
      await expectNoTrialGate(page)
      expect(consoleErrors.filter((error) => !error.includes("favicon")), consoleErrors.join("\n")).toEqual([])
    })
  }
})
