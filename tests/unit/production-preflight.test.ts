import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  evaluateProductionReadiness,
  findForbiddenAutomationReferences,
  findForbiddenProductionRoutes,
  HOBBY_CRON_PATHS,
  hasProductionBlockers,
  REQUIRED_BACKUP_FILES,
  REQUIRED_CRON_PATHS,
  REQUIRED_INFRA_FILES,
} from "@/scripts/production-preflight"

function completeEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_APP_URL: "https://crm.example.com",
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    ENCRYPTION_KEY: "production-encryption-key-32-plus",
    CRON_SECRET: "production-cron-secret-32-plus-ok",
    ALLOWED_ORIGINS: "https://crm.example.com",
    PUBLIC_FORMS_ALLOWED_ORIGINS: "https://forms.example.com",
    PUBLIC_PAY_ALLOWED_ORIGINS: "https://pay.example.com",
    PUBLIC_BOOKING_ALLOWED_ORIGINS: "https://book.example.com",
    REDIS_URL: "rediss://default:password@redis.example.com:6379",
    RATE_LIMIT_FAIL_OPEN: "false",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "CRM <no-reply@example.com>",
    PUBLIC_API_DOCS: "false",
    BILLING_PROVIDER: "manual",
    PAYMENT_GATEWAYS_ENABLED: "bank_transfer,cash,yape,plin,manual",
    AI_PROVIDER: "local",
    WORKFLOW_PROCESSING_MODE: "cron-drainer",
    VERCEL_PLAN: "hobby",
    ...overrides,
  }
}

describe("production preflight", () => {
  it("passes required production checks for a complete environment", () => {
    const checks = evaluateProductionReadiness(completeEnv(), process.cwd())

    expect(hasProductionBlockers(checks)).toBe(false)
    expect(checks.filter((check) => check.status === "warn")).toEqual([])
    expect(checks.find((check) => check.id === "cron:vercel")?.status).toBe("pass")
    expect(checks.find((check) => check.id === "db:migrations")?.status).toBe("pass")
    expect(checks.find((check) => check.id === "security:headers")?.status).toBe("pass")
    expect(checks.find((check) => check.id === "security:csrf")?.status).toBe("pass")
    expect(checks.find((check) => check.id === "security:uploads")?.status).toBe("pass")
  })

  it("fails closed when required production env vars are missing", () => {
    const checks = evaluateProductionReadiness({}, process.cwd())

    expect(hasProductionBlockers(checks)).toBe(true)
    expect(checks.find((check) => check.id === "env:required")?.status).toBe("fail")
    expect(checks.find((check) => check.id === "redis:configured")?.status).toBe("fail")
  })

  it("rejects localhost and wildcard public origins in production", () => {
    const checks = evaluateProductionReadiness(
      completeEnv({
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        PUBLIC_FORMS_ALLOWED_ORIGINS: "*",
      }),
      process.cwd()
    )

    expect(checks.find((check) => check.id === "url:NEXT_PUBLIC_APP_URL")?.status).toBe("fail")
    expect(checks.find((check) => check.id === "origin:PUBLIC_FORMS_ALLOWED_ORIGINS")?.status).toBe("fail")
  })

  it("keeps a deployable Vercel cron profile registered", () => {
    const checks = evaluateProductionReadiness(completeEnv(), process.cwd())
    const cronCheck = checks.find((check) => check.id === "cron:vercel")

    expect(cronCheck?.status).toBe("pass")
    for (const cronPath of [...REQUIRED_CRON_PATHS, ...HOBBY_CRON_PATHS]) {
      expect(cronCheck?.detail || "").not.toContain(cronPath)
    }
  })

  it("keeps daily database backup and staging restore-test automation registered", () => {
    const checks = evaluateProductionReadiness(completeEnv(), process.cwd())
    const backupCheck = checks.find((check) => check.id === "backup:automation")

    expect(backupCheck?.status).toBe("pass")
    for (const requiredFile of REQUIRED_BACKUP_FILES) {
      expect(existsSync(path.join(process.cwd(), requiredFile))).toBe(true)
    }
  })

  it("keeps deployment, healthcheck and observability infrastructure registered", () => {
    const checks = evaluateProductionReadiness(completeEnv(), process.cwd())

    expect(checks.find((check) => check.id === "infra:cicd")?.status).toBe("pass")
    expect(checks.find((check) => check.id === "infra:healthchecks")?.status).toBe("pass")
    expect(checks.find((check) => check.id === "infra:observability")?.status).toBe("pass")
    for (const requiredFile of REQUIRED_INFRA_FILES) {
      expect(existsSync(path.join(process.cwd(), requiredFile))).toBe(true)
    }
  })

  it("allows daily Vercel cron on a Hobby plan", () => {
    const checks = evaluateProductionReadiness(completeEnv({ VERCEL_PLAN: "hobby" }), process.cwd())

    expect(checks.find((check) => check.id === "cron:vercel-plan")?.status).toBe("pass")
  })

  it("rejects Stripe as an active billing provider", () => {
    const checks = evaluateProductionReadiness(completeEnv({ BILLING_PROVIDER: "stripe" }), process.cwd())

    expect(checks.find((check) => check.id === "billing:provider")?.status).toBe("fail")
  })

  it("rejects external gateways when billing is manual", () => {
    const checks = evaluateProductionReadiness(
      completeEnv({ BILLING_PROVIDER: "manual", PAYMENT_GATEWAYS_ENABLED: "culqi,yape" }),
      process.cwd()
    )

    expect(checks.find((check) => check.id === "billing:gateways")?.status).toBe("fail")
  })

  it("requires Gemini credentials when Gemini is selected", () => {
    const checks = evaluateProductionReadiness(
      completeEnv({ AI_PROVIDER: "gemini", GEMINI_API_KEY: undefined }),
      process.cwd()
    )

    expect(checks.find((check) => check.id === "ai:provider")?.status).toBe("fail")
  })

  it("requires a persistent worker when worker mode is selected", () => {
    const checks = evaluateProductionReadiness(
      completeEnv({ WORKFLOW_PROCESSING_MODE: "worker", WORKER_PROCESS_CONFIGURED: undefined }),
      process.cwd()
    )

    expect(checks.find((check) => check.id === "worker:persistent")?.status).toBe("fail")
  })

  it("detects removed automation provider references in scanned files", () => {
    const cwd = path.join(tmpdir(), `crm-preflight-${Date.now()}`)
    mkdirSync(cwd, { recursive: true })
    writeFileSync(path.join(cwd, "README.md"), `legacy ${["n", "8", "n"].join("")} reference`)

    expect(findForbiddenAutomationReferences(cwd)).toEqual(["README.md"])
  })

  it("detects production debug route files", () => {
    const cwd = path.join(tmpdir(), `crm-preflight-debug-${Date.now()}`)
    const routeDir = path.join(cwd, "app", "api", "chat", "simulate")
    const bullBoardDir = path.join(cwd, "app", "api", "admin", "bull-board", "[[...path]]")
    const debugEnvDir = path.join(cwd, "app", "api", "debug-env")
    const mcpServerDir = path.join(cwd, "app", "api", "mcp", "server")
    mkdirSync(routeDir, { recursive: true })
    mkdirSync(bullBoardDir, { recursive: true })
    mkdirSync(debugEnvDir, { recursive: true })
    mkdirSync(mcpServerDir, { recursive: true })
    writeFileSync(path.join(routeDir, "route.ts"), "export function GET() {}")
    writeFileSync(path.join(bullBoardDir, "route.ts"), "export function GET() {}")
    writeFileSync(path.join(debugEnvDir, "route.ts"), "export function GET() {}")
    writeFileSync(path.join(mcpServerDir, "route.ts"), "export function GET() {}")

    expect(findForbiddenProductionRoutes(cwd)).toEqual([
      "app/api/admin/bull-board/[[...path]]/route.ts",
      "app/api/chat/simulate/route.ts",
      "app/api/debug-env/route.ts",
      "app/api/mcp/server/route.ts",
    ])
  })
})
