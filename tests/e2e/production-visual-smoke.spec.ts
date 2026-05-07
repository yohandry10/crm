import { expect, test, type Page } from "@playwright/test"
import { adminPages, appPages, expectNoTrialGate } from "./helpers"

function observePageHealth(pageErrors: string[], consoleErrors: string[], badResponses: string[]) {
  return {
    pageerror: (error: Error) => pageErrors.push(error.message),
    console: (message: { type(): string; text(): string }) => {
      if (message.type() === "error" && !message.text().includes("favicon")) {
        consoleErrors.push(message.text())
      }
    },
    response: (response: { status(): number; url(): string }) => {
      const status = response.status()
      if (status >= 500 || status === 429) {
        badResponses.push(`${status} ${response.url()}`)
      }
    },
  }
}

async function expectHealthyNavigation(page: Page, path: string) {
  const pageErrors: string[] = []
  const consoleErrors: string[] = []
  const badResponses: string[] = []
  const observers = observePageHealth(pageErrors, consoleErrors, badResponses)

  page.on("pageerror", observers.pageerror)
  page.on("console", observers.console)
  page.on("response", observers.response)

  const response = await page.goto(path)
  expect(response?.status(), `${path} should load`).toBeLessThan(400)
  await page.waitForLoadState("networkidle").catch(() => undefined)

  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: /404|No encontrado|Page not found/i })).toHaveCount(0)
  await expectNoTrialGate(page)

  expect(pageErrors, `${path} page errors`).toEqual([])
  expect(consoleErrors, `${path} console errors`).toEqual([])
  expect(badResponses, `${path} bad responses`).toEqual([])

  page.off("pageerror", observers.pageerror)
  page.off("console", observers.console)
  page.off("response", observers.response)
}

test.describe("production visual health smoke", () => {
  for (const path of appPages) {
    test(`regular user module ${path} has no visible runtime failures`, async ({ page }) => {
      await expectHealthyNavigation(page, path)
    })
  }

  test.describe("platform admin", () => {
    test.use({ storageState: "tests/e2e/.auth/superadmin.json" })

    for (const path of adminPages) {
      test(`admin module ${path} has no visible runtime failures`, async ({ page }) => {
        await expectHealthyNavigation(page, path)
      })
    }
  })
})
