import { createClient } from '@supabase/supabase-js'

export type EventType =
    | 'contact.created'
    | 'contact.updated'
    | 'invoice.created'
    | 'invoice.created_from_quote'
    | 'invoice.sent'
    | 'invoice.paid'
    | 'payment.created'
    | 'payment.completed'
    | 'opportunity.created'
    | 'opportunity.updated'
    | 'task.created'
    | 'task.completed'
    | 'ticket.created'
    | 'ticket.resolved'
    | 'campaign.created'
    | 'campaign.sent'
    | 'quote.created'
    | 'quote.sent'
    | 'quote.accepted'
    | 'order.created'
    | 'workflow.executed'

export interface WebhookEvent {
    event_type: EventType
    source: string
    payload: Record<string, any>
}

/**
 * Emit an event to the webhook_events table
 * This allows for event-driven architecture and module interconnections
 */
export async function emitEvent(
    event: WebhookEvent,
    supabase?: any
): Promise<void> {
    try {
        // Use provided supabase client or create admin client
        const client = supabase || createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { error } = await client
            .from('webhook_events')
            .insert({
                event_type: event.event_type,
                source: event.source || 'internal',
                payload: event.payload,
                processed: false
            } as any)

        if (error) {
            console.error('Failed to emit event:', error)
            throw error
        }

        console.log(`Event emitted: ${event.event_type}`)
    } catch (error) {
        console.error('Error in emitEvent:', error)
        // Don't throw - event emission should not break primary operations
    }
}

/**
 * Process pending webhook events
 * This should be called by a background job or cron
 */
export async function processWebhookEvents(): Promise<void> {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get unprocessed events
    const { data: events, error } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('processed', false)
        .lt('retry_count', 3) // Max 3 retries
        .order('created_at', { ascending: true })
        .limit(100)

    if (error || !events) {
        console.error('Failed to fetch webhook events:', error)
        return
    }

    for (const event of events) {
        try {
            await processEvent(event, supabase)

            // Mark as processed
            await supabase
                .from('webhook_events')
                .update({
                    processed: true,
                    processed_at: new Date().toISOString()
                })
                .eq('id', event.id)

        } catch (error: any) {
            console.error(`Failed to process event ${event.id}:`, error)

            // Update retry count and error message
            await supabase
                .from('webhook_events')
                .update({
                    retry_count: event.retry_count + 1,
                    error_message: error.message
                })
                .eq('id', event.id)
        }
    }
}

async function processEvent(event: any, supabase: any): Promise<void> {
    console.log(`Processing event: ${event.event_type}`)

    switch (event.event_type) {
        case 'contact.created':
            await handleContactCreated(event.payload, supabase)
            break

        case 'contact.updated':
            await handleContactUpdated(event.payload, supabase)
            break

        case 'invoice.sent':
            await handleInvoiceSent(event.payload, supabase)
            break

        case 'invoice.paid':
            await handleInvoicePaid(event.payload, supabase)
            break

        case 'payment.completed':
            await handlePaymentCompleted(event.payload, supabase)
            break

        case 'opportunity.created':
            await handleOpportunityCreated(event.payload, supabase)
            break

        case 'opportunity.updated':
            await handleOpportunityUpdated(event.payload, supabase)
            break

        case 'task.created':
            await handleTaskCreated(event.payload, supabase)
            break

        case 'task.completed':
            await handleTaskCompleted(event.payload, supabase)
            break

        case 'ticket.created':
            await handleTicketCreated(event.payload, supabase)
            break

        case 'ticket.resolved':
            await handleTicketResolved(event.payload, supabase)
            break

        case 'campaign.created':
            await handleCampaignCreated(event.payload, supabase)
            break

        case 'quote.created':
            await handleQuoteCreated(event.payload, supabase)
            break

        default:
            console.log(`No handler for event type: ${event.event_type}`)
    }
}

async function handleContactCreated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling contact.created for contact ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('contact.created event missing organization_id in payload')
        return
    }

    // 1. Trigger workflows with event type 'contact.created' for THIS organization only
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'contact.created')
        .eq('is_active', true)
        .eq('organization_id', organizationId)  // ✅ FIX: Filtrar por organization_id

    for (const workflow of workflows || []) {
        try {
            console.log(`Triggering workflow ${workflow.id} for new contact ${payload.id}`)

            // Execute workflow actions
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // Log execution - ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.id,
                status: 'failed',
                error_message: error.message,
                executed_at: new Date().toISOString()
            })
        }
    }
}

async function handleInvoicePaid(payload: any, supabase: any): Promise<void> {
    console.log(`Handling invoice.paid for invoice ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('invoice.paid event missing organization_id in payload')
        return
    }

    // 1. Trigger workflows - ✅ FIX: Filtrar por organization_id
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'invoice.paid')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // 2. Auto-mark opportunity as won if invoice is linked to opportunity
    if (payload.opportunity_id) {
        const { error } = await supabase
            .from('opportunities')
            .update({
                status: 'won',
                close_date: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', payload.opportunity_id)

        if (error) {
            console.error(`Failed to update opportunity ${payload.opportunity_id}:`, error)
        } else {
            console.log(`Opportunity ${payload.opportunity_id} marked as won`)
        }
    }
}



async function handlePaymentCompleted(payload: any, supabase: any): Promise<void> {
    console.log(`Handling payment.completed for payment ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('payment.completed event missing organization_id in payload')
        return
    }

    // 1. Trigger workflows - ✅ FIX: Filtrar por organization_id
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'payment.completed')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // 2. Send receipt notification (future enhancement)
    console.log(`Payment ${payload.id} completed - receipt notification queued`)
}

/**
 * Execute a single workflow action
 * ✅ FIX WF-001: Cambiar userId a organizationId para multi-tenant
 */
async function executeWorkflowAction(
    action: any,
    payload: any,
    supabase: any,
    organizationId: string
): Promise<void> {
    const actionType = action.type

    switch (actionType) {
        case 'send_email':
            await executeSendEmail(action, payload)
            break

        case 'update_lead_score':
            await executeUpdateLeadScore(action, payload, supabase)
            break

        case 'update_lead_status':
            await executeUpdateLeadStatus(action, payload, supabase)
            break

        case 'create_task':
            await executeCreateTask(action, payload, supabase, organizationId)
            break

        case 'webhook':
            await executeWebhook(action, payload)
            break

        default:
            console.log(`Unknown action type: ${actionType}`)
    }
}

/**
 * ✅ FIX: Sanitizar HTML para prevenir XSS
 */
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

async function executeSendEmail(action: any, payload: any): Promise<void> {
    const { to, subject, body, template } = action.params || {}

    // Determinar destinatario: puede venir del action o del payload
    const recipient = to || payload.email || payload.contact_email

    if (!recipient) {
        console.warn('Email action missing recipient - no "to" param or email in payload')
        return
    }

    try {
        const { sendEmail, getEmailTemplate } = await import('./email')

        let emailContent: { subject: string; html: string }

        if (template && ['welcome', 'task_assigned', 'order_completed'].includes(template)) {
            emailContent = getEmailTemplate(template, { ...payload, ...action.params })
        } else {
            // ✅ FIX: Sanitizar payload para prevenir XSS
            const sanitizedPayload = escapeHtml(JSON.stringify(payload, null, 2))
            const sanitizedSubject = escapeHtml(subject || `Notificación CRM - ${payload.event_type || 'Actualización'}`)

            emailContent = {
                subject: sanitizedSubject,
                html: body || `<p>Tienes una nueva notificación relacionada con tu cuenta.</p><pre style="background:#f5f5f5;padding:10px;border-radius:4px;overflow:auto;">${sanitizedPayload}</pre>`
            }
        }

        const result = await sendEmail({
            to: recipient,
            subject: emailContent.subject,
            html: emailContent.html
        })

        if (result.success) {
            console.log(`Email sent successfully to ${recipient}: ${emailContent.subject}`)
        } else {
            console.error(`Failed to send email to ${recipient}:`, result.error)
        }
    } catch (error) {
        console.error('Error sending email:', error)
        // No lanzar error para no interrumpir el workflow
    }
}

async function executeUpdateLeadScore(action: any, payload: any, supabase: any): Promise<void> {
    const { contactId, score } = action.params || {}
    const targetContactId = contactId || payload.id || payload.contact_id

    if (!targetContactId || score === undefined) {
        console.warn('Update lead score action missing parameters')
        return
    }

    // ✅ Validar y normalizar score al rango 0-100
    const normalizedScore = Math.max(0, Math.min(100, Number(score) || 0))

    if (normalizedScore !== score) {
        console.warn(`Lead score ${score} normalized to ${normalizedScore} (valid range: 0-100)`)
    }

    await supabase
        .from('contacts')
        .update({ lead_score: normalizedScore, updated_at: new Date().toISOString() })
        .eq('id', targetContactId)

    console.log(`Updated lead score for contact ${targetContactId} to ${normalizedScore}`)
}

async function executeUpdateLeadStatus(action: any, payload: any, supabase: any): Promise<void> {
    const { contactId, status } = action.params || {}
    const targetContactId = contactId || payload.id || payload.contact_id

    if (!targetContactId || !status) {
        console.warn('Update lead status action missing parameters')
        return
    }

    await supabase
        .from('contacts')
        .update({ lead_status: status, updated_at: new Date().toISOString() })
        .eq('id', targetContactId)

    console.log(`Updated lead status for contact ${targetContactId} to ${status}`)
}

async function executeCreateTask(action: any, payload: any, supabase: any, organizationId: string): Promise<void> {
    const { title, description, due_date, priority, contactId, assigned_to } = action.params || {}
    const targetContactId = contactId || payload.id || payload.contact_id

    if (!title) {
        console.warn('Create task action missing title')
        return
    }

    // ✅ FIX WF-001: Usar organization_id en lugar de user_id
    await supabase.from('tasks').insert({
        organization_id: organizationId,
        assigned_to: assigned_to || payload.created_by || null,
        contact_id: targetContactId,
        title,
        description,
        due_date,
        priority: priority || 'medium',
        status: 'pending'
    })

    console.log(`Created task "${title}" for contact ${targetContactId}`)
}

/**
 * ✅ FIX: Validar URL de webhook para prevenir SSRF
 */
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

        // Verificar protocolo
        if (BLOCKED_PROTOCOLS.includes(url.protocol)) {
            return { valid: false, error: `Protocolo no permitido: ${url.protocol}` }
        }

        // Solo permitir HTTPS en producción
        if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
            return { valid: false, error: 'Solo se permiten URLs HTTPS en producción' }
        }

        // Verificar hosts bloqueados
        const hostname = url.hostname.toLowerCase()
        if (BLOCKED_HOSTS.includes(hostname)) {
            return { valid: false, error: `Host no permitido: ${hostname}` }
        }

        // Verificar rangos de IP privadas
        if (hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.2') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.')) {
            return { valid: false, error: 'No se permiten IPs privadas' }
        }

        return { valid: true }
    } catch {
        return { valid: false, error: 'URL inválida' }
    }
}

async function executeWebhook(action: any, payload: any): Promise<void> {
    const { url, method = 'POST' } = action.params || {}

    if (!url) {
        console.warn('Webhook action missing URL')
        return
    }

    // ✅ FIX: Validar URL antes de hacer request
    const validation = isValidWebhookUrl(url)
    if (!validation.valid) {
        console.error(`[Webhook] URL rechazada: ${validation.error}`)
        throw new Error(`URL de webhook inválida: ${validation.error}`)
    }

    try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'CRM-AI-Peru-Webhook/1.0'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        })

        clearTimeout(timeout)

        if (!response.ok) {
            throw new Error(`Webhook failed with status ${response.status}`)
        }

        console.log(`Webhook called successfully: ${url}`)
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.error(`[Webhook] Timeout: ${url}`)
            throw new Error('Webhook timeout después de 10 segundos')
        }
        console.error(`Webhook failed: ${url}`, error)
        throw error
    }
}


// =====================================================
// HANDLERS ADICIONALES PARA EVENTOS
// =====================================================

async function handleContactUpdated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling contact.updated for contact ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('contact.updated event missing organization_id in payload')
        return
    }

    // Trigger workflows for contact.updated
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'contact.updated')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.id,
                status: 'failed',
                error_message: error.message,
                executed_at: new Date().toISOString()
            })
        }
    }
}

async function handleInvoiceSent(payload: any, supabase: any): Promise<void> {
    console.log(`Handling invoice.sent for invoice ${payload.invoice_id || payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    const userId = payload.user_id || payload.userId || payload.created_by
    if (!organizationId) {
        console.warn('invoice.sent event missing organization_id in payload')
        return
    }

    // Trigger workflows for invoice.sent
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'invoice.sent')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // Crear notificación para el usuario
    if (payload.contact_id && userId) {
        await supabase.from('notifications').insert({
            user_id: userId,
            type: 'info',
            title: 'Factura enviada',
            message: `La factura ${payload.invoice_number || ''} ha sido enviada al cliente.`,
            related_type: 'invoice',
            related_id: payload.invoice_id || payload.id
        })
    }
}

async function handleOpportunityCreated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling opportunity.created for opportunity ${payload.opportunityId || payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('opportunity.created event missing organization_id in payload')
        return
    }

    // Trigger workflows for opportunity.created
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'opportunity.created')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.opportunity?.contact_id || payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }
}

async function handleOpportunityUpdated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling opportunity.updated for opportunity ${payload.opportunityId || payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    const userId = payload.user_id || payload.userId
    if (!organizationId) {
        console.warn('opportunity.updated event missing organization_id in payload')
        return
    }

    // Trigger workflows for opportunity.updated
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'opportunity.updated')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.opportunity?.contact_id || payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // Si cambió de etapa, crear notificación
    if (userId && payload.oldStageId && payload.newStageId && payload.oldStageId !== payload.newStageId) {
        await supabase.from('notifications').insert({
            user_id: userId,
            type: 'info',
            title: 'Oportunidad actualizada',
            message: `La oportunidad "${payload.opportunity?.name || ''}" cambió de etapa.`,
            related_type: 'opportunity',
            related_id: payload.opportunityId || payload.id
        })
    }
}


// =====================================================
// HANDLERS PARA TASKS, TICKETS, CAMPAIGNS, QUOTES
// =====================================================

async function handleTaskCreated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling task.created for task ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    const userId = payload.user_id || payload.userId || payload.created_by
    if (!organizationId) {
        console.warn('task.created event missing organization_id in payload')
        return
    }

    // Trigger workflows for task.created
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'task.created')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // Crear notificación si la tarea está asignada a alguien
    if (payload.assigned_to && payload.assigned_to !== userId) {
        await supabase.from('notifications').insert({
            user_id: payload.assigned_to,
            type: 'info',
            title: 'Nueva tarea asignada',
            message: `Se te ha asignado la tarea: "${payload.title}"`,
            related_type: 'task',
            related_id: payload.id
        })
    }
}

async function handleTaskCompleted(payload: any, supabase: any): Promise<void> {
    console.log(`Handling task.completed for task ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) return

    // Trigger workflows for task.completed
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'task.completed')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }
}

async function handleTicketCreated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling ticket.created for ticket ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('ticket.created event missing organization_id in payload')
        return
    }

    // Trigger workflows for ticket.created
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'ticket.created')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // Notificar al equipo de soporte si es ticket de alta prioridad
    if (payload.priority === 'urgent' || payload.priority === 'high') {
        // Buscar usuarios con rol de soporte
        const { data: supportMembers } = await supabase
            .from('organization_members')
            .select('user_id')
            .eq('organization_id', organizationId)
            .in('role', ['support', 'admin', 'owner'])

        for (const member of supportMembers || []) {
            await supabase.from('notifications').insert({
                user_id: member.user_id,
                type: 'warning',
                title: `Ticket ${payload.priority === 'urgent' ? 'URGENTE' : 'prioritario'}`,
                message: `Nuevo ticket: "${payload.subject}"`,
                related_type: 'ticket',
                related_id: payload.id
            })
        }
    }
}

async function handleTicketResolved(payload: any, supabase: any): Promise<void> {
    console.log(`Handling ticket.resolved for ticket ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) return

    // Trigger workflows for ticket.resolved
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'ticket.resolved')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }
}

async function handleCampaignCreated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling campaign.created for campaign ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    if (!organizationId) {
        console.warn('campaign.created event missing organization_id in payload')
        return
    }

    // Trigger workflows for campaign.created
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'campaign.created')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }
}

async function handleQuoteCreated(payload: any, supabase: any): Promise<void> {
    console.log(`Handling quote.created for quote ${payload.id}`)

    // ✅ FIX WF-001: Usar organization_id para multi-tenant correcto
    const organizationId = payload.organization_id || payload.organizationId
    const userId = payload.user_id || payload.userId || payload.created_by
    if (!organizationId) {
        console.warn('quote.created event missing organization_id in payload')
        return
    }

    // Trigger workflows for quote.created
    const { data: workflows } = await supabase
        .from('workflows')
        .select('*')
        .eq('trigger_type', 'quote.created')
        .eq('is_active', true)
        .eq('organization_id', organizationId)

    for (const workflow of workflows || []) {
        try {
            const actions = workflow.actions || []
            for (const action of actions) {
                await executeWorkflowAction(action, payload, supabase, workflow.organization_id)
            }

            // ✅ FIX WF-003: Incluir organization_id
            await supabase.from('workflow_executions').insert({
                organization_id: organizationId,
                workflow_id: workflow.id,
                contact_id: payload.contact_id,
                status: 'success',
                executed_actions: actions,
                executed_at: new Date().toISOString()
            })
        } catch (error: any) {
            console.error(`Failed to execute workflow ${workflow.id}:`, error)
        }
    }

    // Crear notificación
    if (userId) {
        await supabase.from('notifications').insert({
            user_id: userId,
            type: 'info',
            title: 'Cotización creada',
            message: `Nueva cotización por ${payload.total_amount ? `S/ ${payload.total_amount.toLocaleString()}` : 'monto pendiente'}`,
            related_type: 'quote',
            related_id: payload.id
        })
    }
}
