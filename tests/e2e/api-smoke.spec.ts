import { expect, test } from "@playwright/test"
import { apiGetRoutes, expectedNonOkGetRoutes, userForbiddenGetRoutes } from "./helpers"

test.describe("authenticated API smoke", () => {
  for (const path of apiGetRoutes) {
    test(`GET ${path} returns a successful response`, async ({ request }) => {
      const response = await request.get(path)
      expect(response.status(), await response.text()).toBe(200)
    })
  }

  for (const [path, statuses] of expectedNonOkGetRoutes) {
    test(`GET ${path} returns expected guarded response`, async ({ request }) => {
      const response = await request.get(path)
      expect(statuses, await response.text()).toContain(response.status())
    })
  }

  for (const path of userForbiddenGetRoutes) {
    test(`regular user cannot GET ${path}`, async ({ request }) => {
      const response = await request.get(path)
      expect([401, 403], await response.text()).toContain(response.status())
    })
  }
})
