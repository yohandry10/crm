import { logger } from './logger'

export interface PerformanceMetric {
    endpoint: string
    method: string
    duration_ms: number
    status_code: number
    user_id?: string
    error?: string
}

export interface AlertConfig {
    name: string
    condition: (metric: PerformanceMetric) => boolean
    action: (metric: PerformanceMetric) => Promise<void>
}

const alerts: AlertConfig[] = []

/**
 * Log performance metric
 */
export async function logPerformance(metric: PerformanceMetric): Promise<void> {
    try {
        logger.debug('Performance metric', {
            endpoint: metric.endpoint,
            method: metric.method,
            duration_ms: metric.duration_ms,
            status_code: metric.status_code
        })

        // Check alerts
        for (const alert of alerts) {
            if (alert.condition(metric)) {
                await alert.action(metric)
            }
        }

        // Enviar a servicio de monitoreo si está configurado
        await sendToMonitoringService(metric)

    } catch (error) {
        logger.error('Failed to log performance', error as Error, {
            endpoint: metric.endpoint,
            method: metric.method,
            duration_ms: metric.duration_ms,
            status_code: metric.status_code
        })
    }
}

/**
 * Measure performance of async function
 */
export async function measurePerformance<T>(
    fn: () => Promise<T>,
    context: { endpoint: string; method: string; user_id?: string }
): Promise<{ result: T; duration_ms: number }> {
    const start = Date.now()
    let error: Error | undefined

    try {
        const result = await fn()
        const duration_ms = Date.now() - start

        await logPerformance({
            ...context,
            duration_ms,
            status_code: 200
        })

        return { result, duration_ms }
    } catch (err: any) {
        const duration_ms = Date.now() - start

        await logPerformance({
            ...context,
            duration_ms,
            status_code: 500,
            error: err.message
        })

        throw err
    }
}

/**
 * Register an alert
 */
export function registerAlert(alert: AlertConfig): void {
    alerts.push(alert)
}

/**
 * Default alerts
 */

// Slow endpoint alert (> 2 seconds)
registerAlert({
    name: 'Slow Endpoint',
    condition: (metric) => metric.duration_ms > 2000,
    action: async (metric) => {
        logger.warn('Slow endpoint detected', {
            endpoint: metric.endpoint,
            method: metric.method,
            duration_ms: metric.duration_ms,
            status_code: metric.status_code
        })
        await sendAlert('slow_endpoint', metric)
    }
})

// High error rate alert
let errorCount = 0
let totalCount = 0
registerAlert({
    name: 'High Error Rate',
    condition: (metric) => {
        totalCount++
        if (metric.status_code >= 400) {
            errorCount++
        }

        // Reset every 100 requests
        if (totalCount >= 100) {
            const errorRate = errorCount / totalCount
            errorCount = 0
            totalCount = 0
            return errorRate > 0.1 // Alert if > 10% error rate
        }

        return false
    },
    action: async (metric) => {
        logger.error('High error rate detected (>10%)', undefined, {
            endpoint: metric.endpoint,
            method: metric.method,
            status_code: metric.status_code
        })
        await sendAlert('high_error_rate', metric)
    }
})

/**
 * Track database query performance
 */
export async function trackQuery<T>(
    queryName: string,
    query: Promise<T>
): Promise<T> {
    const start = Date.now()

    try {
        const result = await query
        const duration = Date.now() - start

        if (duration > 1000) {
            logger.warn('Slow query detected', { queryName, duration_ms: duration })
        }

        return result
    } catch (error) {
        const duration = Date.now() - start
        logger.error('Query failed', error as Error, { queryName, duration_ms: duration })
        throw error
    }
}

/**
 * Create monitoring middleware for API routes
 */
export function withMonitoring<T extends any[]>(
    handler: (request: Request, ...args: T) => Promise<Response>
) {
    return async (request: Request, ...args: T): Promise<Response> => {
        const start = Date.now()
        const url = new URL(request.url)
        const endpoint = url.pathname
        const method = request.method

        try {
            const response = await handler(request, ...args)
            const duration_ms = Date.now() - start

            await logPerformance({
                endpoint,
                method,
                duration_ms,
                status_code: response.status
            })

            return response
        } catch (error: any) {
            const duration_ms = Date.now() - start

            await logPerformance({
                endpoint,
                method,
                duration_ms,
                status_code: 500,
                error: error.message
            })

            throw error
        }
    }
}


/**
 * Send metric to external monitoring service
 * Supports: Sentry, DataDog, or custom webhook
 */
async function sendToMonitoringService(metric: PerformanceMetric): Promise<void> {
    // Sentry integration - requires @sentry/nextjs to be installed
    // To enable: pnpm add @sentry/nextjs && set SENTRY_DSN env var
    // Currently disabled - uncomment when Sentry is installed
    /*
    if (process.env.SENTRY_DSN) {
        try {
            const Sentry = await import('@sentry/nextjs')
            Sentry.addBreadcrumb({
                category: 'performance',
                message: `${metric.method} ${metric.endpoint}`,
                level: metric.status_code >= 400 ? 'error' : 'info',
                data: {
                    duration_ms: metric.duration_ms,
                    status_code: metric.status_code,
                    user_id: metric.user_id
                }
            })
            
            if (metric.error) {
                Sentry.captureMessage(`API Error: ${metric.endpoint}`, {
                    level: 'error',
                    extra: metric
                })
            }
        } catch {
            // Sentry not available
        }
    }
    */

    // DataDog integration
    if (process.env.DATADOG_API_KEY) {
        try {
            await fetch('https://api.datadoghq.com/api/v1/series', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'DD-API-KEY': process.env.DATADOG_API_KEY
                },
                body: JSON.stringify({
                    series: [{
                        metric: 'crm.api.response_time',
                        points: [[Math.floor(Date.now() / 1000), metric.duration_ms]],
                        tags: [
                            `endpoint:${metric.endpoint}`,
                            `method:${metric.method}`,
                            `status:${metric.status_code}`
                        ]
                    }]
                })
            })
        } catch {
            // DataDog not available
        }
    }

    // Custom webhook
    if (process.env.MONITORING_WEBHOOK_URL) {
        try {
            await fetch(process.env.MONITORING_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'performance_metric',
                    timestamp: new Date().toISOString(),
                    ...metric
                })
            })
        } catch {
            // Webhook not available
        }
    }
}

/**
 * Send alert to configured alerting services
 */
async function sendAlert(alertType: string, metric: PerformanceMetric): Promise<void> {
    const alertPayload = {
        type: alertType,
        timestamp: new Date().toISOString(),
        metric,
        severity: alertType === 'high_error_rate' ? 'critical' : 'warning'
    }

    // Sentry alert - requires @sentry/nextjs to be installed
    // Currently disabled - uncomment when Sentry is installed
    /*
    if (process.env.SENTRY_DSN) {
        try {
            const Sentry = await import('@sentry/nextjs')
            Sentry.captureMessage(`[ALERT] ${alertType}: ${metric.method} ${metric.endpoint}`, {
                level: alertType === 'high_error_rate' ? 'error' : 'warning',
                extra: alertPayload
            })
        } catch {
            // Sentry not available
        }
    }
    */

    // Slack webhook
    if (process.env.SLACK_WEBHOOK_URL) {
        try {
            await fetch(process.env.SLACK_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚨 *Alert: ${alertType}*`,
                    attachments: [{
                        color: alertType === 'high_error_rate' ? 'danger' : 'warning',
                        fields: [
                            { title: 'Endpoint', value: `${metric.method} ${metric.endpoint}`, short: true },
                            { title: 'Duration', value: `${metric.duration_ms}ms`, short: true },
                            { title: 'Status', value: `${metric.status_code}`, short: true }
                        ]
                    }]
                })
            })
        } catch {
            // Slack not available
        }
    }

    // Custom alert webhook
    if (process.env.ALERT_WEBHOOK_URL) {
        try {
            await fetch(process.env.ALERT_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(alertPayload)
            })
        } catch {
            // Alert webhook not available
        }
    }
}
