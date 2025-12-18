import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

/**
 * =====================================================
 * WORKFLOW LOOP DETECTION
 * Previene ejecución infinita de workflows que se disparan mutuamente
 * =====================================================
 */
const EXECUTION_STACK = new Map<string, number>()
const MAX_RECURSION_DEPTH = 5
const EXECUTION_TIMEOUT_MS = 30000 // 30 segundos máximo por cadena de workflows

// Limpiar stack periódicamente para evitar memory leaks
setInterval(() => {
    const now = Date.now()
    for (const [key] of EXECUTION_STACK) {
        // Las keys incluyen timestamp, limpiar las viejas
        const timestamp = parseInt(key.split(':').pop() || '0')
        if (now - timestamp > EXECUTION_TIMEOUT_MS) {
            EXECUTION_STACK.delete(key)
        }
    }
}, 60000) // Cada minuto

/**
 * Trigger workflows for a given event
 * This integrates with the event system in lib/events.ts
 * Events are emitted to webhook_events table and processed by cron job
 */
export async function triggerWorkflowsForEvent(
    eventType: string,
    payload: any,
    userId?: string
): Promise<void> {
    logger.info('Triggering workflows for event', { eventType })

    // ✅ FIX: Detección de loops
    const executionKey = `${userId || 'system'}:${eventType}:${payload.id || 'unknown'}`
    const currentDepth = EXECUTION_STACK.get(executionKey) || 0

    if (currentDepth >= MAX_RECURSION_DEPTH) {
        logger.warn('Workflow loop detected, stopping execution', { executionKey, depth: currentDepth })
        return
    }

    EXECUTION_STACK.set(executionKey, currentDepth + 1)

    try {
        // Create admin client for workflow operations
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Cleanup execution stack al finalizar
        const cleanupStack = () => {
            const newDepth = (EXECUTION_STACK.get(executionKey) || 1) - 1
            if (newDepth <= 0) {
                EXECUTION_STACK.delete(executionKey)
            } else {
                EXECUTION_STACK.set(executionKey, newDepth)
            }
        }

        // Fetch active workflows matching this event type
        // ✅ FIX WF-001: Usar organization_id del payload para multi-tenant
        const organizationId = payload.organization_id

        let query = supabase
            .from('workflows')
            .select('*')
            .eq('trigger_type', eventType)
            .eq('is_active', true)

        if (organizationId) {
            query = query.eq('organization_id', organizationId)
        }

        const { data: workflows, error } = await query

        if (error) {
            logger.error('Error fetching workflows', error, { eventType })
            return
        }

        if (!workflows || workflows.length === 0) {
            logger.debug('No active workflows for event', { eventType })
            return
        }

        logger.info('Found workflows for event', { eventType, workflowCount: workflows.length })

        // Execute each workflow
        for (const workflow of workflows) {
            try {
                logger.info('Executing workflow', { workflowId: workflow.id, workflowName: workflow.name, eventType })

                // Evaluar condiciones del trigger si existen
                if (workflow.trigger_conditions && !evaluateTriggerConditions(workflow.trigger_conditions, payload)) {
                    logger.debug('Workflow conditions not met, skipping', { workflowId: workflow.id, eventType })
                    continue
                }

                const actions = workflow.actions || []

                if (actions.length === 0) {
                    logger.warn('Workflow has no actions', { workflowId: workflow.id, eventType })
                    continue
                }

                // ✅ FIX WF-002: Execute workflow actions directly instead of via HTTP
                // This avoids auth issues and is more efficient for internal execution
                await executeWorkflowActions(supabase, workflow, payload)
            } catch (error) {
                logger.error('Error executing workflow', error, { workflowId: workflow.id, eventType })
            }
        }
        // Cleanup al finalizar exitosamente
        cleanupStack()
    } catch (error) {
        logger.error('Error in triggerWorkflowsForEvent', error, { eventType })
        // Cleanup también en caso de error
        const newDepth = (EXECUTION_STACK.get(executionKey) || 1) - 1
        if (newDepth <= 0) {
            EXECUTION_STACK.delete(executionKey)
        } else {
            EXECUTION_STACK.set(executionKey, newDepth)
        }
    }
}



/**
 * Evaluate trigger conditions against payload
 * Supports: equals, not_equals, contains, greater_than, less_than, exists
 */
function evaluateTriggerConditions(conditions: any, payload: any): boolean {
    if (!conditions || typeof conditions !== 'object') {
        return true // No conditions = always execute
    }

    // Si es un array, todas las condiciones deben cumplirse (AND)
    if (Array.isArray(conditions)) {
        return conditions.every(condition => evaluateSingleCondition(condition, payload))
    }

    // Si es un objeto con operator, evaluar según el operador
    if (conditions.operator === 'OR') {
        return (conditions.conditions || []).some((c: any) => evaluateSingleCondition(c, payload))
    }

    // Por defecto, AND
    if (conditions.conditions) {
        return conditions.conditions.every((c: any) => evaluateSingleCondition(c, payload))
    }

    // Condición simple
    return evaluateSingleCondition(conditions, payload)
}

function evaluateSingleCondition(condition: any, payload: any): boolean {
    const { field, operator, value } = condition

    if (!field || !operator) {
        logger.warn('Invalid workflow condition - missing field or operator')
        return true
    }

    // Obtener valor del payload (soporta notación de punto: "contact.email")
    const fieldValue = getNestedValue(payload, field)

    switch (operator) {
        case 'equals':
        case 'eq':
            return fieldValue === value

        case 'not_equals':
        case 'neq':
            return fieldValue !== value

        case 'contains':
            return typeof fieldValue === 'string' && fieldValue.includes(value)

        case 'not_contains':
            return typeof fieldValue === 'string' && !fieldValue.includes(value)

        case 'greater_than':
        case 'gt':
            return Number(fieldValue) > Number(value)

        case 'less_than':
        case 'lt':
            return Number(fieldValue) < Number(value)

        case 'greater_than_or_equals':
        case 'gte':
            return Number(fieldValue) >= Number(value)

        case 'less_than_or_equals':
        case 'lte':
            return Number(fieldValue) <= Number(value)

        case 'exists':
            return fieldValue !== undefined && fieldValue !== null

        case 'not_exists':
            return fieldValue === undefined || fieldValue === null

        case 'in':
            return Array.isArray(value) && value.includes(fieldValue)

        case 'not_in':
            return Array.isArray(value) && !value.includes(fieldValue)

        case 'starts_with':
            return typeof fieldValue === 'string' && fieldValue.startsWith(value)

        case 'ends_with':
            return typeof fieldValue === 'string' && fieldValue.endsWith(value)

        case 'regex':
            try {
                return new RegExp(value).test(String(fieldValue))
            } catch {
                return false
            }

        default:
            logger.warn('Unknown workflow condition operator', { operator })
            return true
    }
}

function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined
    }, obj)
}

/**
 * Execute workflow actions directly (for internal/service calls)
 * ✅ FIX WF-002: Direct execution without HTTP call
 */
async function executeWorkflowActions(supabase: any, workflow: any, payload: any): Promise<void> {
    const contact_id = payload.id || payload.contact_id
    const organizationId = payload.organization_id || workflow.organization_id

    // Create execution record - ✅ FIX WF-003: Incluir organization_id
    const { data: execution, error: execError } = await supabase
        .from("workflow_executions")
        .insert({
            organization_id: organizationId,
            workflow_id: workflow.id,
            contact_id,
            status: 'running',
            executed_actions: [],
            error_message: null
        })
        .select()
        .single()

    if (execError) {
        logger.error('Failed to create execution record', execError, {
            workflowId: workflow.id,
            organizationId,
        })
        return
    }

    const executedActions: any[] = []
    const errors: any[] = []

    for (const action of (workflow.actions || []) as any[]) {
        try {
            const result = await executeWorkflowAction(supabase, action, contact_id, organizationId)
            executedActions.push({ action: action.type, success: true, result })
        } catch (error: any) {
            logger.error('Workflow action failed', error, {
                workflowId: workflow.id,
                executionId: execution.id,
                organizationId,
                actionType: action.type,
            })
            errors.push({ action: action.type, error: error.message })
        }
    }

    // Update execution status
    await supabase
        .from("workflow_executions")
        .update({
            status: errors.length > 0 ? 'failed' : 'success',
            executed_actions: executedActions,
            error_message: errors.length > 0 ? JSON.stringify(errors) : null
        })
        .eq('id', execution.id)

    logger.info('Workflow execution completed', {
        workflowId: workflow.id,
        executionId: execution.id,
        organizationId,
        actionsExecuted: executedActions.length,
        errors: errors.length,
    })
}

/**
 * Execute a single workflow action
 */
async function executeWorkflowAction(supabase: any, action: any, contact_id: string, organizationId: string): Promise<any> {
    switch (action.type) {
        case 'send_email':
            const { sendEmail } = await import('@/lib/email')
            const emailResult = await sendEmail({
                to: action.params.to,
                subject: action.params.subject,
                html: action.params.html || action.params.body
            })
            if (!emailResult.success) throw new Error(`Email failed: ${emailResult.error}`)
            return { sent: true, to: action.params.to, emailId: emailResult.id }

        case 'update_lead_score':
            if (!contact_id) throw new Error('contact_id required')
            const { error: scoreError } = await supabase
                .from('contacts')
                .update({ lead_score: action.params.score })
                .eq('id', contact_id)
                .eq('organization_id', organizationId)
            if (scoreError) throw scoreError
            return { updated: true, score: action.params.score }

        case 'update_lead_status':
            if (!contact_id) throw new Error('contact_id required')
            const { error: statusError } = await supabase
                .from('contacts')
                .update({ lead_status: action.params.status })
                .eq('id', contact_id)
                .eq('organization_id', organizationId)
            if (statusError) throw statusError
            return { updated: true, status: action.params.status }

        case 'create_task':
            const { data: task, error: taskError } = await supabase
                .from('tasks')
                .insert({
                    organization_id: organizationId,
                    contact_id: contact_id || null,
                    title: action.params.title,
                    description: action.params.description || null,
                    priority: action.params.priority || 'medium',
                    status: 'pending'
                })
                .select()
                .single()
            if (taskError) throw taskError
            return { created: true, task_id: task.id }

        case 'webhook':
            const response = await fetch(action.params.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action.params.payload || {})
            })
            return { sent: true, status: response.status }

        default:
            throw new Error(`Unknown action type: ${action.type}`)
    }
}
