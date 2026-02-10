import { logger } from "@/lib/logger"

const DEFAULT_TIMEOUT_MS = 1500

/**
 * Best-effort "kick" to trigger near-real-time processing on serverless.
 *
 * The recommended setup is a Cloudflare Worker that:
 * - Verifies this request (Authorization: Bearer <secret>)
 * - Calls Vercel cron endpoints via ctx.waitUntil (process-events + process-workflows)
 *
 * This avoids waiting for Cron frequency to drain queues.
 */
export async function kickBackgroundProcessing(reason: string) {
  const url = (process.env.CF_WORKER_KICK_URL || process.env.WORKER_KICK_URL || "").trim()
  if (!url) return

  const secret =
    (process.env.CF_WORKER_KICK_SECRET || process.env.CRON_SECRET || "").trim()
  if (!secret) {
    logger.warn("Kick URL configured but no secret set (CF_WORKER_KICK_SECRET/CRON_SECRET)")
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason, ts: Date.now() }),
      signal: controller.signal,
    })

    if (!res.ok) {
      logger.debug("Kick background processing returned non-2xx", {
        reason,
        status: res.status,
      })
    }
  } catch (error) {
    // Never block core flows if kick fails.
    logger.debug("Kick background processing failed (ignored)", { reason })
  } finally {
    clearTimeout(timeout)
  }
}

