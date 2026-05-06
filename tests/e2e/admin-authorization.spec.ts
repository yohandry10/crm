import { expect, request as playwrightRequest, test, type APIRequestContext } from "@playwright/test"
import { adminApiGetRoutes, adminPages, expectNoTrialGate } from "./helpers"

const nonPlatformRoles = ["user", "owner", "admin", "manager", "member", "viewer"] as const

async function newRoleContext(baseURL: string | undefined, role: string) {
  return playwrightRequest.newContext({
    baseURL,
    storageState: `tests/e2e/.auth/${role}.json`,
  })
}

async function expectForbidden(responsePromise: Promise<any>, label: string) {
  const response = await responsePromise
  expect(response.status(), `${label}: ${await response.text()}`).toBe(403)
}

async function expectAdminMutationGuards(context: APIRequestContext, role: string) {
  await expectForbidden(
    context.post("/api/admin/organizations", {
      data: {
        name: "Unauthorized Org",
        slug: `unauthorized-${role}-${Date.now()}`,
        ownerEmail: `unauthorized.${role}.${Date.now()}@example.org`,
        trialDays: 2,
      },
    }),
    `${role} cannot create platform organizations`
  )

  await expectForbidden(
    context.post("/api/admin/settings", {
      data: {
        defaultTrialDays: 2,
        allowSelfSignup: true,
        requireEmailVerification: true,
        maintenanceMode: false,
        culqiEnabled: false,
        pagoEfectivoEnabled: false,
      },
    }),
    `${role} cannot update platform settings`
  )

  await expectForbidden(
    context.post("/api/admin/subscriptions/activate", {
      data: {
        organizationId: "00000000-0000-0000-0000-000000000000",
        plan: "professional",
        billingPeriod: "monthly",
        paymentReference: "unauthorized",
      },
    }),
    `${role} cannot activate platform subscriptions`
  )

  await expectForbidden(
    context.patch("/api/admin/users", {
      data: {
        userId: "00000000-0000-0000-0000-000000000000",
        is_platform_admin: true,
      },
    }),
    `${role} cannot grant platform admin`
  )

  await expectForbidden(
    context.post("/api/admin/feature-flags", {
      data: {
        key: "unauthorized-test",
        enabled: true,
      },
    }),
    `${role} cannot mutate platform feature flags`
  )

  await expectForbidden(
    context.post("/api/admin/circuit-breakers", {
      data: {
        service: "unauthorized-test",
        state: "closed",
      },
    }),
    `${role} cannot mutate platform circuit breakers`
  )
}

for (const role of nonPlatformRoles) {
  test.describe(`non-platform role cannot access platform admin: ${role}`, () => {
    test.use({ storageState: `tests/e2e/.auth/${role}.json` })

    test("is redirected away from every admin page", async ({ page }) => {
      for (const adminPage of adminPages) {
        await page.goto(adminPage)
        await expect(page).toHaveURL(/\/dashboard/)
        await expect(page.getByText("Super Admin")).toHaveCount(0)
        await expectNoTrialGate(page)
      }
    })

    test("cannot read or mutate admin APIs", async ({ baseURL }) => {
      const context = await newRoleContext(baseURL, role)

      try {
        for (const route of adminApiGetRoutes) {
          const response = await context.get(route)
          expect(response.status(), `${role} should not read ${route}: ${await response.text()}`).toBe(403)
        }

        await expectAdminMutationGuards(context, role)
      } finally {
        await context.dispose()
      }
    })
  })
}

test.describe("anonymous platform admin boundary", () => {
  test("requires auth before admin API authorization", async ({ baseURL }) => {
    const anonymous = await playwrightRequest.newContext({ baseURL })
    const response = await anonymous.get("/api/admin/stats")

    expect([401, 403]).toContain(response.status())
    await anonymous.dispose()
  })
})
