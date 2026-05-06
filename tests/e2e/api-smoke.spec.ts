import { expect, test } from "@playwright/test"
import { apiGetRoutes, expectedNonOkGetRoutes } from "./helpers"

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
})
