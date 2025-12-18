// import { v4 as uuidv4 } from 'uuid' - Removed to avoid dependency

import { logger } from "./logger"

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
        requestBody: params.requestBody,
    }

    logger.error("Request error", params.error, logPayload)

    return errorId
}
