import { config as loadDotenv } from "dotenv"

loadDotenv({ path: ".env.local", override: false })

type HealthResponse = {
  status?: string
  services?: Record<string, { status?: string; response_time_ms?: number }>
  runtime?: Record<string, unknown>
}

function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

function optionalUrl(value: string | undefined) {
  if (!value?.trim()) return undefined
  try {
    return new URL(value.trim()).toString()
  } catch {
    throw new Error("ALERT_WEBHOOK_URL must be a valid URL")
  }
}

async function notifyAlert(payload: Record<string, unknown>) {
  const webhook = optionalUrl(process.env.ALERT_WEBHOOK_URL)
  if (!webhook) return

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    console.warn(`Alert webhook returned ${response.status}`)
  }
}

async function fetchJson(url: string, headers?: HeadersInit): Promise<{ status: number; body: HealthResponse }> {
  const started = Date.now()
  const response = await fetch(url, { headers, cache: "no-store" })
  const text = await response.text()
  let body: HealthResponse = {}
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { status: "invalid-json" }
  }

  return {
    status: response.status,
    body: {
      ...body,
      response_time_ms: Date.now() - started,
    } as HealthResponse,
  }
}

async function main() {
  const baseUrl = required("HEALTHCHECK_BASE_URL").replace(/\/+$/, "")
  const monitoringSecret = process.env.MONITORING_SECRET || process.env.CRON_SECRET
  const allowDegraded = process.env.HEALTHCHECK_ALLOW_DEGRADED === "true"
  const commit = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "unknown"

  const checks: Record<string, unknown>[] = []

  const publicHealth = await fetchJson(`${baseUrl}/api/health`)
  checks.push({ name: "public-health", ...publicHealth })

  if (!publicHealth.body.status || !["healthy", "degraded"].includes(publicHealth.body.status)) {
    throw new Error(`Public health failed: HTTP ${publicHealth.status} ${JSON.stringify(publicHealth.body)}`)
  }

  if (publicHealth.body.status === "degraded" && !allowDegraded) {
    throw new Error(`Public health degraded: ${JSON.stringify(publicHealth.body.services || {})}`)
  }

  if (monitoringSecret) {
    const deepHealth = await fetchJson(`${baseUrl}/api/health/deep`, {
      authorization: `Bearer ${monitoringSecret}`,
    })
    checks.push({ name: "deep-health", ...deepHealth })

    if (deepHealth.status >= 400 || deepHealth.body.status !== "healthy") {
      const message = `Deep health failed: HTTP ${deepHealth.status} ${JSON.stringify(deepHealth.body)}`
      await notifyAlert({
        level: "error",
        message,
        baseUrl,
        commit,
        checks,
        timestamp: new Date().toISOString(),
      })
      if (!allowDegraded) throw new Error(message)
    }
  } else {
    checks.push({ name: "deep-health", skipped: true, reason: "MONITORING_SECRET/CRON_SECRET not configured" })
  }

  await notifyAlert({
    level: "info",
    message: "Post-deploy healthcheck passed",
    baseUrl,
    commit,
    checks,
    timestamp: new Date().toISOString(),
  })

  console.log(JSON.stringify({ success: true, baseUrl, commit, checks }, null, 2))
}

main().catch(async (error) => {
  await notifyAlert({
    level: "error",
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString(),
  }).catch(() => undefined)

  console.error(error)
  process.exit(1)
})
