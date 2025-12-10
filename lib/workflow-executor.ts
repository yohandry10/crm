/**
 * Workflow Executor - Módulo consolidado para ejecución de acciones
 * ✅ FIX WF-005: Consolidar lógica de ejecución duplicada
 * 
 * Este módulo centraliza toda la lógica de ejecución de acciones de workflows,
 * evitando duplicación entre lib/workflows.ts y lib/events.ts
 */

import { createClient } from '@supabase/supabase-js'
import { validateActionParams, sanitizeActionParams } from './workflow-validators'
import { WORKFLOW_ACTIONS, WorkflowActionType } from './workflow-constants'

// =====================================================
// TYPES
// =====================================================

export interface WorkflowAction {
    type: WorkflowActionType | string
    params?: Record<string, any>
}

export interface ExecutionContext {
    organizationId: string
    contactId?: string
    userId?: string
    payload?: Record<string, any>
}

export interface ActionResult {
    success: boolean
    result?: any
    error?: string
    duration_ms?: number
}

export interface ExecutionResult {
    success: boolean
    executedActions: Array<{
        action: string
        success: boolean
        result?: any
        error?: string
    }>
    errors: string[]
    totalDuration_ms: number
}

// =====================================================
// SECURITY: URL VALIDATION FOR WEBHOOKS
// =====================================================

const BLOCKED_HOSTS = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '169.254.169.254',  // AWS metadata
    'metadata.google.internal',  // GCP metadata
    '::1'  // IPv6 localhost
]

const BLOCKED_PROTOCOLS = ['file:', 'ftp:', 'gopher:', 'data:', 'javascript:']

function isValidWebhookUrl(urlString: string): { valid: boolean; error?: string } {
    try {
        const url = new URL(urlString)

        if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
            return { valid: false, error: `Protocolo no permitido: ${url.protocol}` }
        }

        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
            return { valid: false, error: 'Solo se permiten URLs HTTPS en producción' }
        }

        const hostname = url.hostname.toLowerCase()
        if (BLOCKED_HOSTS.includes(hostname)) {
            return { valid: false, error: `Host no permitido: ${hostname}` }
        }

        // Check private IP ranges
        if (hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
            return { valid: false, error: 'No se permiten IPs privadas' }
        }

        return { valid: true }
    } catch {
        return { valid: false, error: 'URL inválida' }
    }
}

// =====================================================
// SECURITY: HTML SANITIZATION FOR EMAILS
// =====================================================

function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    }
    return text.replace(/[&<>"']/g, (m) => map[m])
}

// =====================================================
// ACTION EXECUTORS
// =====================================================

/**
 * Ejecuta acción de envío de email
 */
async function executeSendEmail(
    params: Record<string, any>,
    context: ExecutionContext
): Promise<ActionResult> {
    const startTime = Date.now()

    const { to, subject, body, template } = params
    const recipient = to || context.payload?.email || context.payload?.contact_email

    if (!recipient) {
        return {
            success: false,
            error: 'Email action missing recipient',
            duration_ms: Date.now() - startTime
        }
    }

    try {
        const { sendEmail, getEmailTemplate } = await import('./email')

        let emailContent: { subject: string; html: string }

        if (template && ['welcome', 'task_assigned', 'order_completed'].includes(template)) {
            emailContent = getEmailTemplate(template, { ...context.payload, ...params })
        } else {
            const sanitizedPayload = escapeHtml(JSON.stringify(context.payload || {}, null, 2))
            const sanitizedSubject = escapeHtml(subject || `Notificación CRM`)

            emailContent = {
                subject: sanitizedSubject,
                html: body || `<p>Tienes una nueva notificación.</p><pre style="background:#f5f5f5;padding:10px;border-radius:4px;overflow:auto;">${sanitizedPayload}</pre>`
            }
        }

        const result = await sendEmail({
            to: recipient,
            subject: emailContent.subject,
            html: emailContent.html
        })

        return {
            success: result.success,
            result: { recipient, subject: emailContent.subject },
            error: result.success ? undefined : result.error,
            duration_ms: Date.now() - startTime
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        }
    }
}

/**
 * Ejecuta acción de actualizar lead score
 */
async function executeUpdateLeadScore(
    supabase: any,
    params: Record<string, any>,
    context: ExecutionContext
): Promise<ActionResult> {
    const startTime = Date.now()

    const { score, contactId } = params
    const targetContactId = contactId || context.contactId

    if (!targetContactId || score === undefined) {
        return {
            success: false,
            error: 'Update lead score missing parameters',
            duration_ms: Date.now() - startTime
        }
    }

    // Normalize score to 0-100 range
    const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0))

    try {
        const { error } = await supabase
            .from('contacts')
            .update({ lead_score: normalizedScore, updated_at: new Date().toISOString() })
            .eq('id', targetContactId)

        if (error) throw error

        return {
            success: true,
            result: { contactId: targetContactId, score: normalizedScore },
            duration_ms: Date.now() - startTime
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        }
    }
}

/**
 * Ejecuta acción de actualizar lead status
 */
async function executeUpdateLeadStatus(
    supabase: any,
    params: Record<string, any>,
    context: ExecutionContext
): Promise<ActionResult> {
    const startTime = Date.now()

    const { status, contactId } = params
    const targetContactId = contactId || context.contactId

    if (!targetContactId || !status) {
        return {
            success: false,
            error: 'Update lead status missing parameters',
            duration_ms: Date.now() - startTime
        }
    }

    try {
        const { error } = await supabase
            .from('contacts')
            .update({ lead_status: status, updated_at: new Date().toISOString() })
            .eq('id', targetContactId)

        if (error) throw error

        return {
            success: true,
            result: { contactId: targetContactId, status },
            duration_ms: Date.now() - startTime
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        }
    }
}

/**
 * Ejecuta acción de crear tarea
 */
async function executeCreateTask(
    supabase: any,
    params: Record<string, any>,
    context: ExecutionContext
): Promise<ActionResult> {
    const startTime = Date.now()

    const { title, description, due_date, priority, assigned_to, contactId } = params
    const targetContactId = contactId || context.contactId

    if (!title) {
        return {
            success: false,
            error: 'Create task missing title',
            duration_ms: Date.now() - startTime
        }
    }

    try {
        const { data, error } = await supabase.from('tasks').insert({
            organization_id: context.organizationId,
            assigned_to: assigned_to || context.userId || null,
            contact_id: targetContactId,
            title,
            description,
            due_date,
            priority: priority || 'medium',
            status: 'pending'
        }).select('id').single()

        if (error) throw error

        return {
            success: true,
            result: { taskId: data?.id, title },
            duration_ms: Date.now() - startTime
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        }
    }
}

/**
 * Ejecuta acción de webhook
 */
async function executeWebhook(
    params: Record<string, any>,
    context: ExecutionContext
): Promise<ActionResult> {
    const startTime = Date.now()

    const { url, method = 'POST', headers = {}, body } = params

    if (!url) {
        return {
            success: false,
            error: 'Webhook missing URL',
            duration_ms: Date.now() - startTime
        }
    }

    // Validate URL for SSRF prevention
    const validation = isValidWebhookUrl(url)
    if (!validation.valid) {
        return {
            success: false,
            error: `URL de webhook inválida: ${validation.error}`,
            duration_ms: Date.now() - startTime
        }
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000)

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CRM-Workflow-Webhook/1.0',
                ...headers
            },
            body: JSON.stringify(body || context.payload),
            signal: controller.signal
        })

        clearTimeout(timeout)

        return {
            success: response.ok,
            result: { status: response.status, url },
            error: response.ok ? undefined : `HTTP ${response.status}`,
            duration_ms: Date.now() - startTime
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.name === 'AbortError' ? 'Timeout después de 10 segundos' : error.message,
            duration_ms: Date.now() - startTime
        }
    }
}

/**
 * Ejecuta acción de enviar notificación
 */
async function executeSendNotification(
    supabase: any,
    params: Record<string, any>,
    context: ExecutionContext
): Promise<ActionResult> {
    const startTime = Date.now()

    const { message, user_ids, type = 'info' } = params

    if (!message) {
        return {
            success: false,
            error: 'Send notification missing message',
            duration_ms: Date.now() - startTime
        }
    }

    try {
        // Si no hay user_ids específicos, notificar al usuario del contexto
        const targetUserIds = user_ids?.length > 0 ? user_ids : (context.userId ? [context.userId] : [])

        if (targetUserIds.length === 0) {
            return {
                success: false,
                error: 'No target users for notification',
                duration_ms: Date.now() - startTime
            }
        }

        const notifications = targetUserIds.map((userId: string) => ({
            user_id: userId,
            type,
            title: 'Notificación de Workflow',
            message,
            related_type: 'workflow',
            created_at: new Date().toISOString()
        }))

        const { error } = await supabase.from('notifications').insert(notifications)

        if (error) throw error

        return {
            success: true,
            result: { notifiedUsers: targetUserIds.length },
            duration_ms: Date.now() - startTime
        }
    } catch (error: any) {
        return {
            success: false,
            error: error.message,
            duration_ms: Date.now() - startTime
        }
    }
}

// =====================================================
// MAIN EXECUTOR
// =====================================================

/**
 * Ejecuta una única acción de workflow
 */
export async function executeWorkflowAction(
    supabase: any,
    action: WorkflowAction,
    context: ExecutionContext
): Promise<ActionResult> {
    const actionType = action.type
    const params = sanitizeActionParams(actionType, action.params || {})

    // Validate action type
    if (!WORKFLOW_ACTIONS.includes(actionType as WorkflowActionType)) {
        return {
            success: false,
            error: `Tipo de acción desconocido: ${actionType}`
        }
    }

    // Validate params
    const validation = validateActionParams(actionType, params)
    if (!validation.valid) {
        console.warn(`[WorkflowExecutor] Validation warning for ${actionType}:`, validation.errors)
        // Continue with execution - validation is advisory for now
    }

    switch (actionType) {
        case 'send_email':
            return executeSendEmail(params, context)

        case 'update_lead_score':
            return executeUpdateLeadScore(supabase, params, context)

        case 'update_lead_status':
            return executeUpdateLeadStatus(supabase, params, context)

        case 'create_task':
            return executeCreateTask(supabase, params, context)

        case 'webhook':
            return executeWebhook(params, context)

        case 'send_notification':
            return executeSendNotification(supabase, params, context)

        case 'add_tag':
        case 'remove_tag':
        case 'assign_to':
        case 'delay':
            // These actions are defined but not yet implemented
            return {
                success: false,
                error: `Acción ${actionType} aún no implementada`
            }

        default:
            return {
                success: false,
                error: `Tipo de acción desconocido: ${actionType}`
            }
    }
}

/**
 * Ejecuta todas las acciones de un workflow
 */
export async function executeWorkflowActions(
    supabase: any,
    actions: WorkflowAction[],
    context: ExecutionContext
): Promise<ExecutionResult> {
    const startTime = Date.now()
    const executedActions: ExecutionResult['executedActions'] = []
    const errors: string[] = []

    for (const action of actions) {
        try {
            const result = await executeWorkflowAction(supabase, action, context)

            executedActions.push({
                action: action.type,
                success: result.success,
                result: result.result,
                error: result.error
            })

            if (!result.success && result.error) {
                errors.push(`${action.type}: ${result.error}`)
            }
        } catch (error: any) {
            console.error(`[WorkflowExecutor] Unexpected error in ${action.type}:`, error)
            executedActions.push({
                action: action.type,
                success: false,
                error: error.message
            })
            errors.push(`${action.type}: ${error.message}`)
        }
    }

    return {
        success: errors.length === 0,
        executedActions,
        errors,
        totalDuration_ms: Date.now() - startTime
    }
}

/**
 * Crea un cliente Supabase admin para operaciones de workflow
 */
export function createWorkflowSupabaseClient() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}
