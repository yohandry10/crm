import { expect, type APIRequestContext, type Page } from "@playwright/test"

export const appPages = [
  "/dashboard",
  "/contacts",
  "/leads",
  "/pipeline",
  "/accounts",
  "/products",
  "/inventory",
  "/quotes",
  "/invoicing",
  "/invoicing/new",
  "/orders",
  "/campaigns",
  "/forms",
  "/tasks",
  "/calendar",
  "/analytics",
  "/reports",
  "/reports/builder",
  "/tickets",
  "/workflows",
  "/integrations",
  "/settings",
  "/settings/team",
  "/settings/billing",
  "/settings/webhooks",
  "/profile",
  "/notifications",
]

export const adminPages = [
  "/admin",
  "/admin/users",
  "/admin/organizations",
  "/admin/subscriptions",
  "/admin/settings",
  "/admin/queues",
]

export const apiGetRoutes = [
  "/api/accounts",
  "/api/activities",
  "/api/activity",
  "/api/analytics",
  "/api/analytics/aggregated",
  "/api/analytics/campaigns",
  "/api/analytics/pipeline",
  "/api/calendar/booking",
  "/api/calendar/events",
  "/api/campaigns",
  "/api/chat",
  "/api/chat/conversations",
  "/api/comprobantes",
  "/api/contacts",
  "/api/contacts/duplicates",
  "/api/dashboard",
  "/api/events",
  "/api/favorites",
  "/api/forms",
  "/api/health",
  "/api/integrations",
  "/api/inventory",
  "/api/inventory/movements",
  "/api/invoices",
  "/api/lead-sources",
  "/api/notifications",
  "/api/opportunities",
  "/api/orders",
  "/api/organizations",
  "/api/payment-links",
  "/api/payments",
  "/api/payments/reconcile",
  "/api/pipeline-stages",
  "/api/products",
  "/api/profile",
  "/api/public/plans",
  "/api/quotes",
  "/api/reports/saved",
  "/api/search",
  "/api/settings",
  "/api/subscriptions/billing",
  "/api/tasks",
  "/api/team",
  "/api/tickets",
  "/api/v1/version",
  "/api/webhooks",
  "/api/workflows",
]

export const adminApiGetRoutes = [
  "/api/admin/circuit-breakers",
  "/api/admin/feature-flags",
  "/api/admin/organizations",
  "/api/admin/plans",
  "/api/admin/settings",
  "/api/admin/stats",
  "/api/admin/subscriptions",
  "/api/admin/users",
]

export const expectedNonOkGetRoutes = new Map([
  ["/api/docs", [200, 404]],
  ["/api/analytics/advanced", [403, 501]],
  ["/api/emails/sync", [400]],
  ["/api/notes", [400]],
  ["/api/pdf/quote", [400]],
  ["/api/upload", [400]],
  ["/api/whatsapp/send", [400]],
])

export const userForbiddenGetRoutes = [
  "/api/admin/circuit-breakers",
  "/api/admin/feature-flags",
  "/api/admin/organizations",
  "/api/admin/plans",
  "/api/admin/settings",
  "/api/admin/stats",
  "/api/admin/subscriptions",
  "/api/admin/users",
]

export async function expectNoTrialGate(page: Page) {
  await expect(page.getByText("Tu período de prueba ha expirado")).toHaveCount(0)
  await expect(page.getByText("Tu periodo de prueba ha expirado")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Ver Planes" })).toHaveCount(0)
}

export async function expectJsonSuccess(response: Awaited<ReturnType<APIRequestContext["post"]>>) {
  expect(response.ok(), await response.text()).toBeTruthy()
  const json = await response.json()
  expect(json.success, JSON.stringify(json)).not.toBe(false)
  return json
}
