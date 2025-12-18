/**
 * Retry utility with exponential backoff
 * ERROR-025: Integrations - Retry logic ausente
 */

import { logger } from "./logger"

export interface RetryOptions {
    maxAttempts?: number
    initialDelay?: number
    maxDelay?: number
    backoffMultiplier?: number
    onRetry?: (attempt: number, error: Error) => void
}

export class RetryError extends Error {
    constructor(
        message: string,
        public readonly attempts: number,
        public readonly lastError: Error
    ) {
        super(message)
        this.name = 'RetryError'
    }
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param options Retry configuration
 * @returns Result of successful execution
 * @throws RetryError if all attempts fail
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        onRetry
    } = options

    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error

            if (attempt === maxAttempts) {
                break
            }

            // Calculate delay with exponential backoff
            const delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt - 1),
                maxDelay
            )

            // Call retry callback if provided
            if (onRetry) {
                onRetry(attempt, lastError)
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw new RetryError(
        `Failed after ${maxAttempts} attempts`,
        maxAttempts,
        lastError!
    )
}

/**
 * Retry a function with specific retry conditions
 * @param fn Function to retry
 * @param shouldRetry Function to determine if error is retryable
 * @param options Retry configuration
 */
export async function retryWithCondition<T>(
    fn: () => Promise<T>,
    shouldRetry: (error: Error) => boolean,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxAttempts = 3,
        initialDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        onRetry
    } = options

    let lastError: Error

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error as Error

            // Check if we should retry this error
            if (!shouldRetry(lastError) || attempt === maxAttempts) {
                throw lastError
            }

            const delay = Math.min(
                initialDelay * Math.pow(backoffMultiplier, attempt - 1),
                maxDelay
            )

            if (onRetry) {
                onRetry(attempt, lastError)
            }

            await new Promise(resolve => setTimeout(resolve, delay))
        }
    }

    throw lastError!
}

/**
 * Check if HTTP error is retryable (5xx, 429, network errors)
 */
export function isRetryableHttpError(error: any): boolean {
    // Network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        return true
    }

    // HTTP status codes that should be retried
    if (error.response?.status) {
        const status = error.response.status
        return status === 429 || (status >= 500 && status < 600)
    }

    return false
}

/**
 * Utility to track retry attempts in database
 */
export async function trackRetryAttempt(
    supabase: any,
    tableName: string,
    recordId: string,
    error: Error
): Promise<void> {
    try {
        await supabase
            .from(tableName)
            .update({
                retry_count: supabase.rpc('increment', { row_id: recordId, field: 'retry_count' }),
                last_retry_at: new Date().toISOString(),
                last_error: error.message
            })
            .eq('id', recordId)
    } catch (dbError) {
        logger.error('Failed to track retry attempt', dbError, { tableName, recordId })
    }
}
