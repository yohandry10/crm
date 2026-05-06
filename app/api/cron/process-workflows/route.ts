import { type NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { getRedisClient } from "@/lib/redis"
import { createRequestLogger } from "@/lib/logger"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { validateCronSecret } from "@/lib/cron-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  const start = Date.now()

  try {
    const authResponse = validateCronSecret(request)
    if (authResponse) return authResponse

    // Safety: this endpoint processes jobs and needs Redis + service role.
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) {
      return NextResponse.json(
        { success: false, error: "Redis no configurado (REDIS_URL / REDIS_HOST)" },
        { status: 500 }
      )
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { success: false, error: "Supabase service role no configurado" },
        { status: 500 }
      )
    }

    const maxMs = Math.min(
      55_000,
      Math.max(2_000, Number(request.nextUrl.searchParams.get("max_ms") || 20_000))
    )
    const maxJobs = Math.min(
      100,
      Math.max(1, Number(request.nextUrl.searchParams.get("max_jobs") || 10))
    )
    const concurrency = Math.min(
      10,
      Math.max(1, Number(request.nextUrl.searchParams.get("concurrency") || 2))
    )

    const redis = getRedisClient()
    const lockKey = "cron:process-workflows:lock"
    const lockValue = crypto.randomUUID()
    const lockTtlMs = maxMs + 15_000

    if (redis) {
      const acquired = await redis.set(lockKey, lockValue, "PX", lockTtlMs, "NX")
      if (!acquired) {
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "Already running",
        })
      }
    }

    const { getWorkflowQueue } = await import("@/lib/queues/workflow-queue")
    const queue = getWorkflowQueue()

    const countsBefore = {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      delayed: await queue.getDelayedCount(),
      failed: await queue.getFailedCount(),
    }

    // If there's nothing to do, avoid starting a Worker at all.
    // In serverless, spinning up a Worker just to immediately close it can
    // trigger noisy Redis connection-close errors in some providers.
    if (countsBefore.waiting === 0 && countsBefore.active === 0 && countsBefore.delayed === 0) {
      // Release lock (best-effort).
      if (redis) {
        try {
          const current = await redis.get(lockKey)
          if (current === lockValue) {
            await redis.del(lockKey)
          }
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        completed: 0,
        failed: 0,
        duration_ms: Date.now() - start,
        countsBefore,
        countsAfter: countsBefore,
        skipped: true,
        reason: "Queue empty",
      })
    }

    let completed = 0
    let failed = 0

    const { createWorkflowWorker } = await import("@/lib/workers/workflow-worker")
    const worker = createWorkflowWorker({
      concurrency,
      registerSignalHandlers: false,
    })

    worker.on("completed", () => {
      completed += 1
    })
    worker.on("failed", () => {
      failed += 1
    })

    const stopAt = Date.now() + maxMs

    // Drain loop: keep the worker alive for a bounded time/job count.
    while (Date.now() < stopAt) {
      if (completed + failed >= maxJobs) break

      const waiting = await queue.getWaitingCount()
      const active = await queue.getActiveCount()
      const delayed = await queue.getDelayedCount()

      if (waiting === 0 && active === 0 && delayed === 0) break

      await sleep(500)
    }

    // Stop the worker. Prefer graceful close to avoid noisy "connection is closed" errors.
    await worker.close()

    const countsAfter = {
      waiting: await queue.getWaitingCount(),
      active: await queue.getActiveCount(),
      delayed: await queue.getDelayedCount(),
      failed: await queue.getFailedCount(),
    }

    // Release lock (best-effort).
    if (redis) {
      try {
        const current = await redis.get(lockKey)
        if (current === lockValue) {
          await redis.del(lockKey)
        }
      } catch {
        // ignore
      }
    }

    log.info("Cron processed workflow queue", {
      completed,
      failed,
      maxJobs,
      maxMs,
      concurrency,
      countsBefore,
      countsAfter,
    })

    return NextResponse.json({
      success: true,
      completed,
      failed,
      duration_ms: Date.now() - start,
      countsBefore,
      countsAfter,
    })
  } catch (error: any) {
    log.error("Cron process-workflows failed", error)
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
