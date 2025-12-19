import crypto from "crypto"

export type LogLevel = "debug" | "info" | "warn" | "error"

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type LogContext = Record<string, unknown>

function levelIndex(level: LogLevel) {
  return { debug: 0, info: 1, warn: 2, error: 3 }[level]
}

function getMinLevel(): LogLevel {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL as LogLevel
  if (process.env.NODE_ENV === "test") return "error"
  return process.env.NODE_ENV === "production" ? "warn" : "debug"
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact)
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      const key = k.toLowerCase()
      const isSecret =
        key.includes("password") ||
        key.includes("secret") ||
        key.includes("token") ||
        key.includes("api_key") ||
        key.includes("apikey") ||
        key.includes("access_key") ||
        key.includes("private_key")
      out[k] = isSecret ? "[REDACTED]" : redact(v)
    }
    return out
  }
  return value
}

function safeJson(context: unknown): string | undefined {
  if (!context) return undefined
  try {
    return JSON.stringify(redact(context) as JsonValue)
  } catch {
    return undefined
  }
}

class Logger {
  private minLevel: LogLevel = getMinLevel()

  private shouldLog(level: LogLevel) {
    return levelIndex(level) >= levelIndex(this.minLevel)
  }

  private write(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return

    const entry = {
      ts: new Date().toISOString(),
      level,
      message,
      ...(context ? { context: redact(context) } : {}),
    }

    const line = safeJson(entry) || `${entry.ts} ${level.toUpperCase()} ${message}`
    const sink = level === "debug" ? console.log : console[level]
    sink(line)
  }

  debug(message: string, context?: LogContext) {
    this.write("debug", message, context)
  }

  info(message: string, context?: LogContext) {
    this.write("info", message, context)
  }

  warn(message: string, context?: LogContext) {
    this.write("warn", message, context)
  }

  error(message: string, error?: unknown, context?: LogContext) {
    const err =
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error
    this.write("error", message, { ...(context || {}), ...(error ? { error: err } : {}) })
  }
}

export const logger = new Logger()

export function createRequestLogger(request: Request, organizationId?: string) {
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID()
  const url = (() => {
    try {
      return new URL(request.url).pathname
    } catch {
      return undefined
    }
  })()

  const base = { requestId, organizationId, url }

  return {
    debug: (message: string, context?: LogContext) => logger.debug(message, { ...base, ...(context || {}) }),
    info: (message: string, context?: LogContext) => logger.info(message, { ...base, ...(context || {}) }),
    warn: (message: string, context?: LogContext) => logger.warn(message, { ...base, ...(context || {}) }),
    error: (message: string, error?: unknown, context?: LogContext) =>
      logger.error(message, error, { ...base, ...(context || {}) }),
  }
}
