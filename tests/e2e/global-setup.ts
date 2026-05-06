import { mkdir } from "node:fs/promises"
import path from "node:path"
import { request, type FullConfig } from "@playwright/test"
import dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required E2E env var: ${name}`)
  return value
}

async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ||
    process.env.BASE_URL ||
    config.projects[0]?.use?.baseURL?.toString() ||
    "http://localhost:3000"

  const email = requireEnv("TEST_USER_EMAIL")
  const password = requireEnv("TEST_USER_PASSWORD")
  const authDir = path.join(process.cwd(), "tests/e2e/.auth")
  const authFile = path.join(authDir, "superadmin.json")

  await mkdir(authDir, { recursive: true })

  const context = await request.newContext({ baseURL })
  const response = await context.post("/api/auth/login", {
    data: { email, password },
  })

  if (!response.ok()) {
    throw new Error(`E2E login failed: ${response.status()} ${await response.text()}`)
  }

  await context.storageState({ path: authFile })
  await context.dispose()
}

export default globalSetup
