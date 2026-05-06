// import { v4 as uuidv4 } from 'uuid' - Removed to avoid dependency

import { logger } from "./logger"

const SENSITIVE_KEY_PATTERN = /password|pass|secret|token|key|credential|authorization|api[_-]?key|config/i

function sanitizeForErrorLog(value: any, depth = 0): any {
    if (value === null || value === undefined) return value
    if (depth > 5) return "[REDACTED:DEPTH]"

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForErrorLog(item, depth + 1))
    }

    if (typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, nestedValue]) => [
                key,
                SENSITIVE_KEY_PATTERN.test(key) ? "[REDACTED]" : sanitizeForErrorLog(nestedValue, depth + 1),
            ])
        )
    }

    return value
}

export async function logError(params: {
    errorId?: string
    endpoint: string
    method: string
    error: any
    userId?: string
    requestBody?: any
}) {
    const errorId = params.errorId || crypto.randomUUID()

    // In a real production app, this would send to Sentry, Datadog, etc.
    // For now, we log to console with a structured format that can be parsed.
    const logPayload = {
        timestamp: new Date().toISOString(),
        level: 'ERROR',
        errorId,
        endpoint: params.endpoint,
        method: params.method,
        userId: params.userId || 'anonymous',
        message: params.error?.message || 'Unknown error',
        requestBody: sanitizeForErrorLog(params.requestBody),
    }

    logger.error("Request error", params.error, logPayload)

    return errorId
}
