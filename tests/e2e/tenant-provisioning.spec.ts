import { expect, test } from "@playwright/test"

test("regular organization users cannot self-provision new tenants", async ({ request }) => {
  const response = await request.post("/api/organizations", {
    headers: {
      cookie: "csrf-token=tenant-provisioning-test",
      "x-csrf-token": "tenant-provisioning-test",
    },
    data: {
      name: `Forbidden Tenant ${Date.now()}`,
      slug: `forbidden-tenant-${Date.now()}`,
    },
  })

  expect(response.status(), await response.text()).toBe(403)
  const json = await response.json()
  expect(json.success).toBe(false)
  expect(json.error).toMatch(/superadmin|csrf/i)
})

test("auth bootstrap does not create a tenant outside the platform sales flow", async ({ request }) => {
  const response = await request.post("/api/auth/bootstrap", { data: {} })

  expect(response.ok(), await response.text()).toBeTruthy()
  const json = await response.json()
  expect(json.success).toBe(true)
  expect(json.data.organizationCreated).toBe(false)
})
