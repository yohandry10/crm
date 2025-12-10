/**
 * Workflow Logging Utilities
 * ✅ FIX WF-009: Logging completo para errores de ejecución
 */

// =====================================================
// TYPES
// =====================================================

export interface LogEntry {
    timestamp: string
    level: 'info' | 'warn' | 'error' | 'debug'
    module: string
    message: string
    context?: Record<string, any>
    error?: {
        name: string
        message: string
        stack?: string
    }
}

export interface WorkflowLogContext {
    workflowId?: string
    workflowName?: string
    executionId?: string
    organizationId?: string
    contactId?: string
    actionType?: string
    actionIndex?: number
}

// =====================================================
// LOGGING FUNCTIONS
// =====================================================

/**
 * Crea un entry de log estructurado
 */
function createLogEntry(
    level: LogEntry['level'],
    module: string,
    message: string,
    context?: WorkflowLogContext,
    error?: Error
): LogEntry {
    const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        module,
        message,
        context: context as Record<string, any>
    }

    if (error) {
        entry.error = {
            name: error.name,
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
    }

    return entry
}

/**
 * Formatea un log entry para consola
 */
function formatForConsole(entry: LogEntry): string {
    const prefix = `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.module}]`
    const contextStr = entry.context ? ` | Context: ${JSON.stringify(entry.context)}` : ''
    const errorStr = entry.error ? ` | Error: ${entry.error.message}` : ''
    return `${prefix} ${entry.message}${contextStr}${errorStr}`
}

// =====================================================
// WORKFLOW LOGGER
// =====================================================

export const workflowLogger = {
    /**
     * Log de inicio de workflow
     */
    workflowStart(workflowId: string, workflowName: string, organizationId: string, contactId?: string) {
        const entry = createLogEntry('info', 'Workflow', 'Workflow execution started', {
            workflowId,
            workflowName,
            organizationId,
            contactId
        })
        console.log(formatForConsole(entry))
        return entry
    },

    /**
     * Log de finalización exitosa de workflow
     */
    workflowComplete(
        workflowId: string,
        executionId: string,
        actionsExecuted: number,
        durationMs: number
    ) {
        const entry = createLogEntry('info', 'Workflow', 'Workflow execution completed', {
            workflowId,
            executionId
        })
        entry.context = {
            ...entry.context,
            actionsExecuted,
            durationMs
        }
        console.log(formatForConsole(entry))
        return entry
    },

    /**
     * Log de error en workflow
     */
    workflowError(
        workflowId: string,
        executionId: string | undefined,
        error: Error,
        context?: Record<string, any>
    ) {
        const entry = createLogEntry('error', 'Workflow', 'Workflow execution failed', {
            workflowId,
            executionId,
            ...context
        }, error)
        console.error(formatForConsole(entry))
        if (process.env.NODE_ENV === 'development' && error.stack) {
            console.error(error.stack)
        }
        return entry
    },

    /**
     * Log de inicio de acción
     */
    actionStart(
        workflowId: string,
        executionId: string,
        actionType: string,
        actionIndex: number,
        inputParams?: Record<string, any>
    ) {
        const entry = createLogEntry('debug', 'WorkflowAction', `Action ${actionType} started`, {
            workflowId,
            executionId,
            actionType,
            actionIndex
        })
        if (process.env.NODE_ENV === 'development') {
            entry.context = { ...entry.context, inputParams }
        }
        console.log(formatForConsole(entry))
        return entry
    },

    /**
     * Log de acción completada
     */
    actionComplete(
        workflowId: string,
        executionId: string,
        actionType: string,
        actionIndex: number,
        success: boolean,
        durationMs: number,
        result?: any
    ) {
        const level = success ? 'info' : 'warn'
        const entry = createLogEntry(level, 'WorkflowAction',
            `Action ${actionType} ${success ? 'completed' : 'failed'}`, {
            workflowId,
            executionId,
            actionType,
            actionIndex
        })
        entry.context = {
            ...entry.context,
            success,
            durationMs,
            result: process.env.NODE_ENV === 'development' ? result : undefined
        }
        console.log(formatForConsole(entry))
        return entry
    },

    /**
     * Log de error en acción
     */
    actionError(
        workflowId: string,
        executionId: string,
        actionType: string,
        actionIndex: number,
        error: Error | string,
        inputParams?: Record<string, any>
    ) {
        const errorObj = error instanceof Error ? error : new Error(String(error))
        const entry = createLogEntry('error', 'WorkflowAction',
            `Action ${actionType} error`, {
            workflowId,
            executionId,
            actionType,
            actionIndex
        }, errorObj)

        if (process.env.NODE_ENV === 'development') {
            entry.context = { ...entry.context, inputParams }
        }

        console.error(formatForConsole(entry))
        return entry
    },

    /**
     * Log de validación fallida
     */
    validationError(
        workflowId: string,
        actionType: string,
        errors: string[]
    ) {
        const entry = createLogEntry('warn', 'WorkflowValidation',
            `Validation failed for action ${actionType}`, {
            workflowId,
            actionType
        })
        entry.context = { ...entry.context, validationErrors: errors }
        console.warn(formatForConsole(entry))
        return entry
    },

    /**
     * Log de trigger de evento
     */
    eventTrigger(
        eventType: string,
        organizationId: string,
        workflowCount: number
    ) {
        const entry = createLogEntry('info', 'WorkflowTrigger',
            `Event ${eventType} triggered ${workflowCount} workflow(s)`, {
            organizationId
        })
        entry.context = { ...entry.context, eventType, workflowCount }
        console.log(formatForConsole(entry))
        return entry
    },

    /**
     * Log de condiciones no cumplidas
     */
    conditionsNotMet(
        workflowId: string,
        workflowName: string,
        reason?: string
    ) {
        const entry = createLogEntry('debug', 'WorkflowCondition',
            `Workflow ${workflowName} conditions not met`, {
            workflowId,
            workflowName
        })
        if (reason) {
            entry.context = { ...entry.context, reason }
        }
        console.log(formatForConsole(entry))
        return entry
    }
}

// =====================================================
// DATABASE LOGGING
// =====================================================

/**
 * Guarda un log de error en la base de datos (para auditoría)
 */
export async function persistWorkflowError(
    supabase: any,
    organizationId: string,
    workflowId: string,
    executionId: string | undefined,
    error: Error,
    context?: Record<string, any>
): Promise<void> {
    try {
        // Solo persistir si hay un executionId (la ejecución ya inició)
        if (executionId) {
            await supabase
                .from('workflow_executions')
                .update({
                    status: 'failed',
                    error_message: error.message,
                    updated_at: new Date().toISOString()
                })
                .eq('id', executionId)
        }

        // También podríamos guardar en una tabla de logs de sistema
        // Por ahora solo actualizamos workflow_executions

    } catch (dbError) {
        console.error('[WorkflowLogger] Failed to persist error to database:', dbError)
    }
}

/**
 * Guarda métricas de ejecución
 */
export async function persistExecutionMetrics(
    supabase: any,
    executionId: string,
    metrics: {
        totalDuration_ms: number
        actionsExecuted: number
        actionsSucceeded: number
        actionsFailed: number
    }
): Promise<void> {
    try {
        await supabase
            .from('workflow_executions')
            .update({
                status: metrics.actionsFailed > 0 ? 'partial_failure' : 'success',
                executed_actions_count: metrics.actionsExecuted,
                duration_ms: metrics.totalDuration_ms,
                updated_at: new Date().toISOString()
            })
            .eq('id', executionId)
    } catch (error) {
        console.error('[WorkflowLogger] Failed to persist metrics:', error)
    }
}

export default workflowLogger
