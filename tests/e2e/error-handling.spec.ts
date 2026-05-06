import { expect, test } from "@playwright/test"

test.describe("global error handling", () => {
  test("client error reporter stores a sanitized structured error", async ({ request }) => {
    const csrfResponse = await request.get("/api/auth/csrf")
    const { csrfToken } = await csrfResponse.json()

    const response = await request.post("/api/client-errors", {
      headers: { "x-csrf-token": csrfToken },
      data: {
        source: "window-error",
        message: "Synthetic E2E client error",
        stack: "Error: Synthetic E2E client error\n    at test",
        path: "/dashboard",
        userAgent: "playwright",
      },
    })

    expect(response.status(), await response.text()).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.errorId).toEqual(expect.any(String))
  })

  test("client error reporter rejects malformed payloads with friendly json", async ({ request }) => {
    const csrfResponse = await request.get("/api/auth/csrf")
    const { csrfToken } = await csrfResponse.json()

    const response = await request.post("/api/client-errors", {
      headers: { "x-csrf-token": csrfToken },
      data: {
        source: "unknown",
        message: "",
      },
    })

    expect(response.status(), await response.text()).toBe(400)
    const json = await response.json()
    expect(json).toEqual({ success: false, error: "Payload inválido" })
  })
})
