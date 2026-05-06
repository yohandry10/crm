import { NextRequest, NextResponse } from "next/server"
import os from "node:os"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { isRedisHealthy } from "@/lib/redis"
import { logger } from "@/lib/logger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CheckStatus = "healthy" | "degraded" | "down"

type CheckResult = {
  status: CheckStatus
  response_time_ms: number
  detail?: string
  metrics?: Record<string, number | string | boolean | null>
}

function monitoringSecret() {
  return process.env.MONITORING_SECRET?.trim() || process.env.CRON_SECRET?.trim()
}

function isAuthorized(request: NextRequest) {
  const secret = monitoringSecret()
  if (!secret) return false

  return (
    request.headers.get("x-monitoring-secret") === secret ||
    request.headers.get("x-cron-secret") === secret ||
    request.headers.get("authorization") === `Bearer ${secret}`
  )
}

async function timed<T>(fn: () => Promise<T>) {
  const start = Date.now()
  const result = await fn()
  return { result, ms: Date.now() - start }
}

async function checkDatabase(): Promise<CheckResult> {
  try {
    const { ms, result } = await timed(async () => {
      const supabase = createSupabaseServiceClient()
      return supabase.from("profiles").select("id", { count: "exact", head: true }).limit(1)
    })

    return {
      status: result.error ? "down" : ms > 1500 ? "degraded" : "healthy",
      response_time_ms: ms,
      detail: result.error ? "database query failed" : undefined,
    }
  } catch (error) {
    logger.error("Deep health database check failed", error)
    return { status: "down", response_time_ms: 0, detail: "database check exception" }
  }
}

async function checkRedis(): Promise<CheckResult> {
  const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST)
  if (!redisConfigured) {
    return {
      status: process.env.RATE_LIMIT_FAIL_OPEN === "true" ? "degraded" : "down",
      response_time_ms: 0,
      detail: "redis is not configured",
    }
  }

  try {
    const { ms, result } = await timed(() => isRedisHealthy())
    return {
      status: result ? (ms > 1000 ? "degraded" : "healthy") : "down",
      response_time_ms: ms,
    }
  } catch (error) {
    logger.error("Deep health redis check failed", error)
    return { status: "down", response_time_ms: 0, detail: "redis check exception" }
  }
}

async function checkQueues(): Promise<CheckResult> {
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
    return { status: "down", response_time_ms: 0, detail: "redis required for queue stats" }
  }

  try {
    const { ms, result } = await timed(async () => {
      const [{ getQueueStats }, { getEmailQueueStats }, { getImportQueueStats }] = await Promise.all([
        import("@/lib/queues/workflow-queue"),
        import("@/lib/queues/email-queue"),
        import("@/lib/queues/import-queue"),
      ])

      const [workflows, emails, imports] = await Promise.all([
        getQueueStats(),
        getEmailQueueStats(),
        getImportQueueStats(),
      ])

      return { workflows, emails, imports }
    })

    const failed = result.workflows.failed + result.emails.failed + result.imports.failed
    const waiting = result.workflows.waiting + result.emails.waiting + result.imports.waiting
    const status: CheckStatus = failed > 0 ? "degraded" : waiting > 100 ? "degraded" : "healthy"

    return {
      status,
      response_time_ms: ms,
      metrics: {
        workflow_waiting: result.workflows.waiting,
        workflow_failed: result.workflows.failed,
        email_waiting: result.emails.waiting,
        email_failed: result.emails.failed,
        import_waiting: result.imports.waiting,
        import_failed: result.imports.failed,
      },
    }
  } catch (error) {
    logger.error("Deep health queue check failed", error)
    return { status: "degraded", response_time_ms: 0, detail: "queue stats unavailable" }
  }
}

function runtimeMetrics() {
  const memory = process.memoryUsage()
  const cpu = process.cpuUsage()
  const freeMem = os.freemem()
  const totalMem = os.totalmem()

  return {
    node_env: process.env.NODE_ENV || "unknown",
    vercel_env: process.env.VERCEL_ENV || "local",
    region: process.env.VERCEL_REGION || "unknown",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_SHA || "unknown",
    uptime_seconds: Math.round(process.uptime()),
    loadavg_1m: Number(os.loadavg()[0].toFixed(2)),
    memory_rss_mb: Math.round(memory.rss / 1024 / 1024),
    memory_heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
    system_memory_used_pct: totalMem ? Number((((totalMem - freeMem) / totalMem) * 100).toFixed(2)) : null,
    cpu_user_ms: Math.round(cpu.user / 1000),
    cpu_system_ms: Math.round(cpu.system / 1000),
  }
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const started = Date.now()
  const [database, redis, queues] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkQueues(),
  ])

  const services = { database, redis, queues }
  const hasDown = Object.values(services).some((service) => service.status === "down")
  const hasDegraded = Object.values(services).some((service) => service.status === "degraded")
  const status: CheckStatus = hasDown ? "down" : hasDegraded ? "degraded" : "healthy"

  const body = {
    status,
    timestamp: new Date().toISOString(),
    response_time_ms: Date.now() - started,
    services,
    runtime: runtimeMetrics(),
  }

  logger.info("Deep health check completed", {
    status,
    response_time_ms: body.response_time_ms,
    database: database.status,
    redis: redis.status,
    queues: queues.status,
  })

  return NextResponse.json(body, { status: status === "healthy" ? 200 : 503 })
}
