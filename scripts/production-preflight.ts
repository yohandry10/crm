import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { config as loadDotenv } from "dotenv"

export type ProductionCheckStatus = "pass" | "warn" | "fail"

export interface ProductionCheck {
  id: string
  status: ProductionCheckStatus
  message: string
  detail?: string
}

type Env = Record<string, string | undefined>

const REQUIRED_ENV = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ENCRYPTION_KEY",
  "CRON_SECRET",
  "ALLOWED_ORIGINS",
  "PUBLIC_FORMS_ALLOWED_ORIGINS",
  "PUBLIC_PAY_ALLOWED_ORIGINS",
  "PUBLIC_BOOKING_ALLOWED_ORIGINS",
  "RESEND_API_KEY",
  "EMAIL_FROM",
] as const

export const REQUIRED_MIGRATIONS = [
  "094_atomic_manual_payments.sql",
  "095_security_definer_hardening.sql",
  "096_stripe_event_processing_status.sql",
  "097_security_definer_rpc_hardening.sql",
  "098_atomic_public_booking.sql",
  "099_public_payment_tokens_hardening.sql",
  "100_revenue_inventory_consistency.sql",
  "101_production_readiness_verification_rpc.sql",
  "102_payment_provider_settings.sql",
  "103_target_db_verification_fixes.sql",
] as const

export const REQUIRED_CRON_PATHS = [
  "/api/cron/process-events",
  "/api/cron/process-workflows",
  "/api/cron/expire-quotes",
  "/api/cron/cleanup-analytics-cache",
  "/api/cron/cleanup-auditoria",
] as const

export const HOBBY_CRON_PATHS = [
  "/api/cron/daily-maintenance",
  "/api/cron/process-workflows",
] as const

const PLACEHOLDER_RE = /^(changeme|change-me|secret|password|example|your-|your_|todo|test)$/i
const TEXT_EXTENSIONS = new Set([
  ".css",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".sql",
  ".ts",
  ".tsx",
  ".txt",
  ".yml",
  ".yaml",
])

const EXCLUDED_SCAN_DIRS = new Set([
  ".git",
  ".next",
  ".next-build",
  ".turbo",
  "coverage",
  "node_modules",
])

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

function addCheck(
  checks: ProductionCheck[],
  id: string,
  status: ProductionCheckStatus,
  message: string,
  detail?: string
) {
  checks.push({ id, status, message, detail })
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  return (
    normalized === "localhost" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    normalized.startsWith("127.") ||
    normalized.endsWith(".local")
  )
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

function validateHttpsUrl(
  checks: ProductionCheck[],
  env: Env,
  name: string,
  options: { allowSupabase?: boolean } = {}
) {
  const value = env[name]?.trim()
  if (!value) return

  const url = parseUrl(value)
  if (!url) {
    addCheck(checks, `url:${name}`, "fail", `${name} must be a valid URL`)
    return
  }

  if (url.protocol !== "https:") {
    addCheck(checks, `url:${name}`, "fail", `${name} must use https in production`)
    return
  }

  if (!options.allowSupabase && isLocalHostname(url.hostname)) {
    addCheck(checks, `url:${name}`, "fail", `${name} cannot point to localhost in production`)
    return
  }

  addCheck(checks, `url:${name}`, "pass", `${name} is a production URL`)
}

function validateSecret(
  checks: ProductionCheck[],
  env: Env,
  name: string,
  minLength: number
) {
  const value = env[name]?.trim()
  if (!value) return

  if (value.length < minLength) {
    addCheck(checks, `secret:${name}`, "fail", `${name} must be at least ${minLength} characters`)
    return
  }

  if (PLACEHOLDER_RE.test(value)) {
    addCheck(checks, `secret:${name}`, "fail", `${name} cannot use a placeholder value`)
    return
  }

  addCheck(checks, `secret:${name}`, "pass", `${name} is present and long enough`)
}

function parseCsv(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function validateOriginList(checks: ProductionCheck[], env: Env, name: string) {
  const origins = parseCsv(env[name])
  if (origins.length === 0) return

  const invalid: string[] = []

  for (const origin of origins) {
    if (origin === "*") {
      invalid.push("*")
      continue
    }

    const url = parseUrl(origin)
    if (!url || url.protocol !== "https:" || isLocalHostname(url.hostname)) {
      invalid.push(origin)
      continue
    }

    const normalized = origin.replace(/\/+$/, "")
    if (url.origin !== normalized) {
      invalid.push(origin)
    }
  }

  if (invalid.length > 0) {
    addCheck(
      checks,
      `origin:${name}`,
      "fail",
      `${name} must contain only exact https origins`,
      `Invalid entries: ${invalid.join(", ")}`
    )
    return
  }

  addCheck(checks, `origin:${name}`, "pass", `${name} has strict production origins`)
}

type VercelCronEntry = {
  path: string
  schedule: string
}

export function getVercelCronEntries(cwd: string): VercelCronEntry[] | null {
  const vercelPath = path.join(cwd, "vercel.json")
  if (!existsSync(vercelPath)) return null

  const json = JSON.parse(readFileSync(vercelPath, "utf8"))
  if (!Array.isArray(json.crons)) return []

  return json.crons
    .map((cron: { path?: unknown; schedule?: unknown }) => ({
      path: typeof cron.path === "string" ? cron.path : "",
      schedule: typeof cron.schedule === "string" ? cron.schedule : "",
    }))
    .filter((cron: VercelCronEntry) => Boolean(cron.path))
}

export function getVercelCronPaths(cwd: string): string[] | null {
  const entries = getVercelCronEntries(cwd)
  return entries ? entries.map((entry) => entry.path) : null
}

function hasCronPaths(cronPaths: string[], requiredPaths: readonly string[]) {
  return requiredPaths.every((requiredPath) => cronPaths.includes(requiredPath))
}

function isDailyCronSchedule(schedule: string) {
  const parts = schedule.trim().split(/\s+/)
  if (parts.length !== 5) return false

  const [minute, hour] = parts
  return (
    minute !== "*" &&
    hour !== "*" &&
    !minute.includes("/") &&
    !hour.includes("/")
  )
}

function checkRequiredCrons(checks: ProductionCheck[], env: Env, cwd: string) {
  if (env.EXTERNAL_CRON_CONFIGURED === "true") {
    addCheck(checks, "cron:external", "pass", "External authenticated scheduler is configured")
    return
  }

  try {
    const cronEntries = getVercelCronEntries(cwd)
    if (cronEntries === null) {
      addCheck(checks, "cron:vercel", "fail", "vercel.json is missing cron configuration")
      return
    }

    const cronPaths = cronEntries.map((entry) => entry.path)
    const hasFullCronProfile = hasCronPaths(cronPaths, REQUIRED_CRON_PATHS)
    const hasHobbyCronProfile = hasCronPaths(cronPaths, HOBBY_CRON_PATHS)

    if (!hasFullCronProfile && !hasHobbyCronProfile) {
      const missing = REQUIRED_CRON_PATHS.filter((requiredPath) => !cronPaths.includes(requiredPath))
      addCheck(
        checks,
        "cron:vercel",
        "fail",
        "vercel.json is missing required production cron jobs",
        `Missing paths: ${missing.join(", ")}`
      )
      return
    }

    addCheck(
      checks,
      "cron:vercel",
      "pass",
      hasHobbyCronProfile && !hasFullCronProfile
        ? "Hobby-compatible daily Vercel cron jobs are configured"
        : "Required Vercel cron jobs are configured"
    )

    const plan = env.VERCEL_PLAN?.trim().toLowerCase()
    if (plan === "hobby") {
      const invalidSchedules = cronEntries.filter((entry) => !isDailyCronSchedule(entry.schedule))
      if (cronEntries.length > 2 || invalidSchedules.length > 0) {
        addCheck(
          checks,
          "cron:vercel-plan",
          "fail",
          "Vercel Hobby requires at most two daily cron jobs",
          invalidSchedules.map((entry) => `${entry.path}: ${entry.schedule}`).join(", ")
        )
      } else {
        addCheck(checks, "cron:vercel-plan", "pass", "Vercel Hobby daily cron profile is configured")
      }
    } else if (!plan) {
      addCheck(
        checks,
        "cron:vercel-plan",
        "warn",
        "Set VERCEL_PLAN=hobby, pro, or enterprise, or use EXTERNAL_CRON_CONFIGURED=true with an external scheduler"
      )
    } else if (hasHobbyCronProfile && !hasFullCronProfile) {
      addCheck(checks, "cron:vercel-plan", "pass", "Vercel daily cron profile is compatible with the configured project")
    } else {
      addCheck(checks, "cron:vercel-plan", "pass", "Vercel plan is marked as compatible with frequent cron")
    }
  } catch (error: any) {
    addCheck(checks, "cron:vercel", "fail", "vercel.json cron configuration is not valid JSON", error.message)
  }
}

function checkMigrations(checks: ProductionCheck[], cwd: string) {
  const missing = REQUIRED_MIGRATIONS.filter(
    (fileName) => !existsSync(path.join(cwd, "supabase", "migrations", fileName))
  )

  if (missing.length > 0) {
    addCheck(
      checks,
      "db:migrations",
      "fail",
      "Required production hardening migrations are missing",
      `Missing files: ${missing.join(", ")}`
    )
    return
  }

  addCheck(checks, "db:migrations", "pass", "Required production hardening migrations exist")
}

function scanTextFiles(cwd: string, visitor: (relativePath: string, content: string) => void) {
  const stack = [cwd]

  while (stack.length > 0) {
    const current = stack.pop()!
    const entries = readdirSync(current)

    for (const entry of entries) {
      const absolutePath = path.join(current, entry)
      const relativePath = path.relative(cwd, absolutePath)
      const stat = statSync(absolutePath)

      if (stat.isDirectory()) {
        if (!EXCLUDED_SCAN_DIRS.has(entry)) stack.push(absolutePath)
        continue
      }

      if (entry === "pnpm-lock.yaml") continue
      if (!TEXT_EXTENSIONS.has(path.extname(entry))) continue

      visitor(relativePath, readFileSync(absolutePath, "utf8"))
    }
  }
}

export function findForbiddenAutomationReferences(cwd: string): string[] {
  const token = ["n", "8", "n"].join("")
  const matches: string[] = []

  scanTextFiles(cwd, (relativePath, content) => {
    if (content.toLowerCase().includes(token)) {
      matches.push(relativePath)
    }
  })

  return matches.sort()
}

function checkForbiddenReferences(checks: ProductionCheck[], cwd: string) {
  const matches = findForbiddenAutomationReferences(cwd)
  if (matches.length > 0) {
    addCheck(
      checks,
      "repo:forbidden-automation",
      "fail",
      "Removed automation provider references are still present",
      `Files: ${matches.slice(0, 20).join(", ")}${matches.length > 20 ? " ..." : ""}`
    )
    return
  }

  addCheck(checks, "repo:forbidden-automation", "pass", "Removed automation provider references are absent")
}

function checkRedis(checks: ProductionCheck[], env: Env) {
  if (!present(env.REDIS_URL) && !present(env.REDIS_HOST)) {
    addCheck(checks, "redis:configured", "fail", "Redis is required for production rate limits and BullMQ")
    return
  }

  if (present(env.REDIS_URL)) {
    const url = parseUrl(env.REDIS_URL!.trim())
    if (!url) {
      addCheck(checks, "redis:configured", "fail", "REDIS_URL must be a valid URL")
      return
    }

    if (url.protocol !== "rediss:") {
      addCheck(checks, "redis:tls", "warn", "REDIS_URL should use rediss:// unless Redis is private-network only")
    }
  }

  addCheck(checks, "redis:configured", "pass", "Redis is configured")
}

function checkBillingProvider(checks: ProductionCheck[], env: Env) {
  const billingProvider = env.BILLING_PROVIDER?.trim().toLowerCase()
  const supported = new Set(["disabled", "manual", "culqi", "pagoefectivo", "culqi_pagoefectivo"])

  if (!billingProvider) {
    addCheck(checks, "billing:provider", "warn", "Set BILLING_PROVIDER=manual, culqi, pagoefectivo, or culqi_pagoefectivo")
    return
  }

  if (billingProvider === "stripe") {
    addCheck(
      checks,
      "billing:provider",
      "fail",
      "Stripe is not an active billing provider for this project"
    )
    return
  }

  if (!supported.has(billingProvider)) {
    addCheck(
      checks,
      "billing:provider",
      "fail",
      "Unsupported billing provider",
      `Configured: ${billingProvider}`
    )
    return
  }

  if (billingProvider === "disabled" || billingProvider === "manual") {
    addCheck(checks, "billing:provider", "pass", `Billing provider is ${billingProvider}`)
    return
  }

  const requiredVars =
    billingProvider === "culqi"
      ? ["CULQI_PUBLIC_KEY", "CULQI_SECRET_KEY"]
      : billingProvider === "pagoefectivo"
        ? ["PAGOEFECTIVO_API_KEY", "PAGOEFECTIVO_WEBHOOK_SECRET"]
        : ["CULQI_PUBLIC_KEY", "CULQI_SECRET_KEY", "PAGOEFECTIVO_API_KEY", "PAGOEFECTIVO_WEBHOOK_SECRET"]
  const missing = requiredVars.filter((name) => !present(env[name]))

  if (missing.length > 0) {
    addCheck(
      checks,
      "billing:provider",
      "fail",
      `${billingProvider} billing is selected but credentials are missing`,
      `Missing: ${missing.join(", ")}`
    )
    return
  }

  addCheck(checks, "billing:provider", "pass", `${billingProvider} billing credentials are present`)
}

function checkAiProvider(checks: ProductionCheck[], env: Env) {
  const provider = env.AI_PROVIDER?.trim().toLowerCase()

  if (provider === "local" || provider === "fallback" || provider === "disabled") {
    addCheck(checks, "ai:provider", "pass", `AI provider is explicitly ${provider}`)
    return
  }

  if (provider === "gemini") {
    if (!present(env.GEMINI_API_KEY)) {
      addCheck(checks, "ai:provider", "fail", "AI_PROVIDER=gemini requires GEMINI_API_KEY")
      return
    }

    addCheck(checks, "ai:provider", "pass", "Gemini provider is configured")
    return
  }

  if (!provider) {
    addCheck(
      checks,
      "ai:provider",
      "warn",
      "Set AI_PROVIDER=gemini, local, fallback, or disabled"
    )
    return
  }

  addCheck(checks, "ai:provider", "fail", `Unsupported AI_PROVIDER=${provider}`)
}

function checkWorkflowProcessing(checks: ProductionCheck[], env: Env) {
  const mode = env.WORKFLOW_PROCESSING_MODE?.trim().toLowerCase()

  if (mode === "cron-drainer") {
    addCheck(checks, "worker:persistent", "pass", "Workflow processing uses bounded cron drainer")
    return
  }

  if (mode === "worker") {
    if (env.WORKER_PROCESS_CONFIGURED !== "true") {
      addCheck(checks, "worker:persistent", "fail", "WORKFLOW_PROCESSING_MODE=worker requires WORKER_PROCESS_CONFIGURED=true")
      return
    }

    addCheck(checks, "worker:persistent", "pass", "Persistent workflow worker is marked as configured")
    return
  }

  if (env.WORKER_PROCESS_CONFIGURED === "true") {
    addCheck(checks, "worker:persistent", "pass", "Persistent worker process is marked as configured")
    return
  }

  addCheck(
    checks,
    "worker:persistent",
    "warn",
    "Set WORKFLOW_PROCESSING_MODE=cron-drainer or worker"
  )
}

export function evaluateProductionReadiness(env: Env = process.env, cwd = process.cwd()): ProductionCheck[] {
  const checks: ProductionCheck[] = []

  const missingEnv = REQUIRED_ENV.filter((name) => !present(env[name]))
  if (missingEnv.length > 0) {
    addCheck(
      checks,
      "env:required",
      "fail",
      "Required production environment variables are missing",
      `Missing: ${missingEnv.join(", ")}`
    )
  } else {
    addCheck(checks, "env:required", "pass", "Required production environment variables are present")
  }

  validateHttpsUrl(checks, env, "NEXT_PUBLIC_APP_URL")
  validateHttpsUrl(checks, env, "NEXT_PUBLIC_SUPABASE_URL", { allowSupabase: true })
  validateSecret(checks, env, "CRON_SECRET", 32)
  validateSecret(checks, env, "ENCRYPTION_KEY", 32)

  if (
    present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    present(env.SUPABASE_SERVICE_ROLE_KEY) &&
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY === env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    addCheck(checks, "supabase:keys", "fail", "Supabase anon and service role keys must be different")
  } else if (present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) && present(env.SUPABASE_SERVICE_ROLE_KEY)) {
    addCheck(checks, "supabase:keys", "pass", "Supabase anon and service role keys are distinct")
  }

  for (const originName of [
    "ALLOWED_ORIGINS",
    "PUBLIC_FORMS_ALLOWED_ORIGINS",
    "PUBLIC_PAY_ALLOWED_ORIGINS",
    "PUBLIC_BOOKING_ALLOWED_ORIGINS",
  ]) {
    validateOriginList(checks, env, originName)
  }

  checkRedis(checks, env)
  checkRequiredCrons(checks, env, cwd)
  checkMigrations(checks, cwd)
  checkForbiddenReferences(checks, cwd)
  checkBillingProvider(checks, env)
  checkAiProvider(checks, env)

  if (env.RATE_LIMIT_FAIL_OPEN === "true") {
    addCheck(checks, "ratelimit:fail-open", "fail", "RATE_LIMIT_FAIL_OPEN must not be true in production")
  } else {
    addCheck(checks, "ratelimit:fail-open", "pass", "Rate limiting is not configured to fail open")
  }

  if (env.PUBLIC_API_DOCS === "true") {
    addCheck(checks, "docs:public-api", "fail", "PUBLIC_API_DOCS must be false or unset in production")
  } else {
    addCheck(checks, "docs:public-api", "pass", "Public API docs are not forced on")
  }

  if (env.LOG_LEVEL === "debug") {
    addCheck(checks, "logs:level", "warn", "LOG_LEVEL=debug is too noisy for production")
  }

  if (present(env.CF_WORKER_KICK_URL) && !present(env.CF_WORKER_KICK_SECRET) && !present(env.CRON_SECRET)) {
    addCheck(checks, "worker:kick-secret", "fail", "Worker kick URL is configured without a secret")
  }

  checkWorkflowProcessing(checks, env)

  return checks
}

export function hasProductionBlockers(checks: ProductionCheck[]): boolean {
  return checks.some((check) => check.status === "fail")
}

export function loadProductionEnvFiles(cwd = process.cwd()) {
  for (const fileName of [".env.production.local", ".env.production", ".env.local", ".env"]) {
    const envPath = path.join(cwd, fileName)
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false })
    }
  }
}

function printChecks(checks: ProductionCheck[]) {
  const label: Record<ProductionCheckStatus, string> = {
    pass: "PASS",
    warn: "WARN",
    fail: "FAIL",
  }

  for (const check of checks) {
    console.log(`[${label[check.status]}] ${check.id}: ${check.message}`)
    if (check.detail) console.log(`       ${check.detail}`)
  }

  const failures = checks.filter((check) => check.status === "fail").length
  const warnings = checks.filter((check) => check.status === "warn").length
  console.log(`\nProduction preflight: ${failures} failure(s), ${warnings} warning(s)`)
}

const currentFile = fileURLToPath(import.meta.url)
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : ""

if (invokedFile === currentFile) {
  loadProductionEnvFiles()
  const checks = evaluateProductionReadiness()
  printChecks(checks)
  process.exitCode = hasProductionBlockers(checks) ? 1 : 0
}
