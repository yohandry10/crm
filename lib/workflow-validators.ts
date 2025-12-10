/**
 * Workflow Action Validators
 * ✅ FIX WF-004: Validación de parámetros de acciones
 */

import { z } from 'zod'
import { WorkflowActionType, WORKFLOW_ACTIONS } from './workflow-constants'

// =====================================================
// ACTION PARAMETER SCHEMAS
// =====================================================

/**
 * Schema para acción send_email
 */
export const sendEmailParamsSchema = z.object({
    to: z.string().email().optional(),
    subject: z.string().min(1).max(200).optional(),
    body: z.string().optional(),
    template: z.enum(['welcome', 'task_assigned', 'order_completed', 'notification']).optional()
}).refine(
    data => data.to || data.template,
    { message: 'Se requiere "to" o "template"' }
)

/**
 * Schema para acción update_lead_score
 */
export const updateLeadScoreParamsSchema = z.object({
    score: z.number().min(0).max(100),
    contactId: z.string().uuid().optional()
})

/**
 * Schema para acción update_lead_status
 */
export const updateLeadStatusParamsSchema = z.object({
    status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
    contactId: z.string().uuid().optional()
})

/**
 * Schema para acción create_task
 */
export const createTaskParamsSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    due_date: z.string().datetime().optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
    assigned_to: z.string().uuid().optional(),
    contactId: z.string().uuid().optional()
})

/**
 * Schema para acción webhook
 */
export const webhookParamsSchema = z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).optional().default('POST'),
    headers: z.record(z.string()).optional(),
    body: z.any().optional()
})

/**
 * Schema para acción send_notification
 */
export const sendNotificationParamsSchema = z.object({
    message: z.string().min(1).max(500),
    user_ids: z.array(z.string().uuid()).optional(),
    type: z.enum(['info', 'success', 'warning', 'error']).optional().default('info')
})

/**
 * Schema para acción add_tag
 */
export const addTagParamsSchema = z.object({
    tag: z.string().min(1).max(50)
})

/**
 * Schema para acción remove_tag
 */
export const removeTagParamsSchema = z.object({
    tag: z.string().min(1).max(50)
})

/**
 * Schema para acción assign_to
 */
export const assignToParamsSchema = z.object({
    user_id: z.string().uuid()
})

/**
 * Schema para acción delay
 */
export const delayParamsSchema = z.object({
    duration: z.number().min(1).max(86400), // 1 segundo a 24 horas
    unit: z.enum(['seconds', 'minutes', 'hours']).optional().default('seconds')
})

// =====================================================
// ACTION SCHEMAS MAP
// =====================================================

/**
 * Mapa de schemas por tipo de acción
 */
export const ACTION_PARAM_SCHEMAS: Record<WorkflowActionType, z.ZodTypeAny> = {
    'send_email': sendEmailParamsSchema,
    'update_lead_score': updateLeadScoreParamsSchema,
    'update_lead_status': updateLeadStatusParamsSchema,
    'create_task': createTaskParamsSchema,
    'webhook': webhookParamsSchema,
    'send_notification': sendNotificationParamsSchema,
    'add_tag': addTagParamsSchema,
    'remove_tag': removeTagParamsSchema,
    'assign_to': assignToParamsSchema,
    'delay': delayParamsSchema
}

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

export interface ValidationResult {
    valid: boolean
    errors?: string[]
    params?: Record<string, any>
}

/**
 * Valida los parámetros de una acción específica
 */
export function validateActionParams(
    actionType: string,
    params: Record<string, any>
): ValidationResult {
    // Verificar si el tipo de acción es válido
    if (!WORKFLOW_ACTIONS.includes(actionType as WorkflowActionType)) {
        return {
            valid: false,
            errors: [`Tipo de acción desconocido: ${actionType}`]
        }
    }

    const schema = ACTION_PARAM_SCHEMAS[actionType as WorkflowActionType]

    try {
        const validatedParams = schema.parse(params || {})
        return {
            valid: true,
            params: validatedParams
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            }
        }
        return {
            valid: false,
            errors: ['Error de validación desconocido']
        }
    }
}

/**
 * Valida todas las acciones de un workflow
 */
export function validateWorkflowActions(
    actions: Array<{ type: string; params?: Record<string, any> }>
): ValidationResult {
    const errors: string[] = []

    for (let i = 0; i < actions.length; i++) {
        const action = actions[i]
        const result = validateActionParams(action.type, action.params || {})

        if (!result.valid && result.errors) {
            errors.push(...result.errors.map(e => `Acción ${i + 1} (${action.type}): ${e}`))
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined
    }
}

/**
 * Sanitiza y valida parámetros, retornando valores por defecto si faltan
 */
export function sanitizeActionParams(
    actionType: string,
    params: Record<string, any>
): Record<string, any> {
    const schema = ACTION_PARAM_SCHEMAS[actionType as WorkflowActionType]

    if (!schema) {
        return params || {}
    }

    try {
        return schema.parse(params || {})
    } catch {
        // Si falla la validación, retornar los params originales
        // El error se manejará en la ejecución
        return params || {}
    }
}

// =====================================================
// WORKFLOW ACTION SCHEMA (FOR API)
// =====================================================

/**
 * Schema completo para una acción de workflow
 */
export const workflowActionSchema = z.object({
    type: z.enum(WORKFLOW_ACTIONS),
    params: z.record(z.any()).optional().default({})
})

/**
 * Schema para array de acciones
 */
export const workflowActionsArraySchema = z.array(workflowActionSchema)

/**
 * Valida y transforma un array de acciones
 */
export function parseWorkflowActions(
    actions: unknown
): { valid: boolean; actions?: z.infer<typeof workflowActionsArraySchema>; errors?: string[] } {
    try {
        const parsed = workflowActionsArraySchema.parse(actions)

        // Validar parámetros de cada acción
        // Convertir a tipo compatible para validación
        const actionsForValidation = parsed.map(a => ({
            type: a.type,
            params: a.params
        }))
        const paramValidation = validateWorkflowActions(actionsForValidation)

        if (!paramValidation.valid) {
            return {
                valid: false,
                errors: paramValidation.errors
            }
        }

        return {
            valid: true,
            actions: parsed
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                valid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
            }
        }
        return {
            valid: false,
            errors: ['Error de validación desconocido']
        }
    }
}
