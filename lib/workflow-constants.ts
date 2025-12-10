/**
 * Workflow Constants
 * ✅ FIX WF-006: Centralizar tipos de trigger y acciones
 * Fuente única de verdad para tipos de workflows
 */

// =====================================================
// TRIGGER TYPES
// =====================================================

/**
 * Tipos de trigger soportados por el sistema de workflows
 */
export const WORKFLOW_TRIGGERS = [
    'contact.created',
    'contact.updated',
    'invoice.created',
    'invoice.sent',
    'invoice.paid',
    'payment.created',
    'payment.completed',
    'opportunity.created',
    'opportunity.updated',
    'task.created',
    'task.completed',
    'ticket.created',
    'ticket.resolved',
    'campaign.created',
    'campaign.sent',
    'quote.created',
    'quote.sent',
    'quote.accepted',
    'manual',
    'schedule'
] as const

export type WorkflowTriggerType = typeof WORKFLOW_TRIGGERS[number]

/**
 * Metadatos de los triggers para UI
 */
export const WORKFLOW_TRIGGER_META: Record<WorkflowTriggerType, {
    label: string
    description: string
    icon: string
    category: 'contact' | 'sales' | 'task' | 'support' | 'marketing' | 'manual'
}> = {
    'contact.created': {
        label: 'Contacto creado',
        description: 'Se activa cuando se crea un nuevo contacto',
        icon: 'UserPlus',
        category: 'contact'
    },
    'contact.updated': {
        label: 'Contacto actualizado',
        description: 'Se activa cuando se actualiza un contacto',
        icon: 'UserCog',
        category: 'contact'
    },
    'invoice.created': {
        label: 'Factura creada',
        description: 'Se activa cuando se crea una nueva factura',
        icon: 'FileText',
        category: 'sales'
    },
    'invoice.sent': {
        label: 'Factura enviada',
        description: 'Se activa cuando se envía una factura',
        icon: 'Send',
        category: 'sales'
    },
    'invoice.paid': {
        label: 'Factura pagada',
        description: 'Se activa cuando se marca una factura como pagada',
        icon: 'CheckCircle',
        category: 'sales'
    },
    'payment.created': {
        label: 'Pago creado',
        description: 'Se activa cuando se registra un nuevo pago',
        icon: 'CreditCard',
        category: 'sales'
    },
    'payment.completed': {
        label: 'Pago completado',
        description: 'Se activa cuando un pago es completado',
        icon: 'BadgeCheck',
        category: 'sales'
    },
    'opportunity.created': {
        label: 'Oportunidad creada',
        description: 'Se activa cuando se crea una nueva oportunidad',
        icon: 'Target',
        category: 'sales'
    },
    'opportunity.updated': {
        label: 'Oportunidad actualizada',
        description: 'Se activa cuando se actualiza una oportunidad',
        icon: 'TrendingUp',
        category: 'sales'
    },
    'task.created': {
        label: 'Tarea creada',
        description: 'Se activa cuando se crea una nueva tarea',
        icon: 'ListTodo',
        category: 'task'
    },
    'task.completed': {
        label: 'Tarea completada',
        description: 'Se activa cuando se completa una tarea',
        icon: 'CheckSquare',
        category: 'task'
    },
    'ticket.created': {
        label: 'Ticket creado',
        description: 'Se activa cuando se crea un nuevo ticket de soporte',
        icon: 'Ticket',
        category: 'support'
    },
    'ticket.resolved': {
        label: 'Ticket resuelto',
        description: 'Se activa cuando se resuelve un ticket',
        icon: 'TicketCheck',
        category: 'support'
    },
    'campaign.created': {
        label: 'Campaña creada',
        description: 'Se activa cuando se crea una nueva campaña',
        icon: 'Megaphone',
        category: 'marketing'
    },
    'campaign.sent': {
        label: 'Campaña enviada',
        description: 'Se activa cuando se envía una campaña',
        icon: 'Rocket',
        category: 'marketing'
    },
    'quote.created': {
        label: 'Cotización creada',
        description: 'Se activa cuando se crea una nueva cotización',
        icon: 'FileSpreadsheet',
        category: 'sales'
    },
    'quote.sent': {
        label: 'Cotización enviada',
        description: 'Se activa cuando se envía una cotización',
        icon: 'Send',
        category: 'sales'
    },
    'quote.accepted': {
        label: 'Cotización aceptada',
        description: 'Se activa cuando el cliente acepta una cotización',
        icon: 'ThumbsUp',
        category: 'sales'
    },
    'manual': {
        label: 'Ejecución manual',
        description: 'Se ejecuta manualmente desde la interfaz',
        icon: 'Play',
        category: 'manual'
    },
    'schedule': {
        label: 'Programado',
        description: 'Se ejecuta según un horario programado',
        icon: 'Clock',
        category: 'manual'
    }
}

// =====================================================
// ACTION TYPES
// =====================================================

/**
 * Tipos de acciones soportadas por el sistema de workflows
 */
export const WORKFLOW_ACTIONS = [
    'send_email',
    'update_lead_score',
    'update_lead_status',
    'create_task',
    'webhook',
    'send_notification',
    'add_tag',
    'remove_tag',
    'assign_to',
    'delay'
] as const

export type WorkflowActionType = typeof WORKFLOW_ACTIONS[number]

/**
 * Metadatos de las acciones para UI
 */
export const WORKFLOW_ACTION_META: Record<WorkflowActionType, {
    label: string
    description: string
    icon: string
    requiredParams: string[]
    optionalParams: string[]
}> = {
    'send_email': {
        label: 'Enviar email',
        description: 'Envía un email al contacto o a una dirección específica',
        icon: 'Mail',
        requiredParams: [],
        optionalParams: ['to', 'subject', 'body', 'template']
    },
    'update_lead_score': {
        label: 'Actualizar puntuación',
        description: 'Actualiza la puntuación del lead',
        icon: 'Star',
        requiredParams: ['score'],
        optionalParams: ['contactId']
    },
    'update_lead_status': {
        label: 'Actualizar estado',
        description: 'Actualiza el estado del lead',
        icon: 'RefreshCw',
        requiredParams: ['status'],
        optionalParams: ['contactId']
    },
    'create_task': {
        label: 'Crear tarea',
        description: 'Crea una nueva tarea relacionada',
        icon: 'ListPlus',
        requiredParams: ['title'],
        optionalParams: ['description', 'due_date', 'priority', 'assigned_to']
    },
    'webhook': {
        label: 'Webhook',
        description: 'Envía una solicitud HTTP a una URL externa',
        icon: 'Globe',
        requiredParams: ['url'],
        optionalParams: ['method', 'headers', 'body']
    },
    'send_notification': {
        label: 'Enviar notificación',
        description: 'Envía una notificación a usuarios específicos',
        icon: 'Bell',
        requiredParams: ['message'],
        optionalParams: ['user_ids', 'type']
    },
    'add_tag': {
        label: 'Agregar etiqueta',
        description: 'Agrega una etiqueta al contacto',
        icon: 'Tag',
        requiredParams: ['tag'],
        optionalParams: []
    },
    'remove_tag': {
        label: 'Remover etiqueta',
        description: 'Remueve una etiqueta del contacto',
        icon: 'TagOff',
        requiredParams: ['tag'],
        optionalParams: []
    },
    'assign_to': {
        label: 'Asignar a',
        description: 'Asigna el contacto o tarea a un usuario',
        icon: 'UserCheck',
        requiredParams: ['user_id'],
        optionalParams: []
    },
    'delay': {
        label: 'Esperar',
        description: 'Espera un tiempo antes de continuar',
        icon: 'Timer',
        requiredParams: ['duration'],
        optionalParams: ['unit']
    }
}

// =====================================================
// UTILITIES
// =====================================================

/**
 * Verifica si un string es un tipo de trigger válido
 */
export function isValidTriggerType(type: string): type is WorkflowTriggerType {
    return WORKFLOW_TRIGGERS.includes(type as WorkflowTriggerType)
}

/**
 * Verifica si un string es un tipo de acción válido
 */
export function isValidActionType(type: string): type is WorkflowActionType {
    return WORKFLOW_ACTIONS.includes(type as WorkflowActionType)
}

/**
 * Obtiene triggers por categoría
 */
export function getTriggersByCategory(category: string): WorkflowTriggerType[] {
    return WORKFLOW_TRIGGERS.filter(
        trigger => WORKFLOW_TRIGGER_META[trigger].category === category
    )
}

/**
 * Opciones para select de triggers (para UI)
 */
export const WORKFLOW_TRIGGER_OPTIONS = WORKFLOW_TRIGGERS.map(trigger => ({
    value: trigger,
    label: WORKFLOW_TRIGGER_META[trigger].label,
    description: WORKFLOW_TRIGGER_META[trigger].description,
    icon: WORKFLOW_TRIGGER_META[trigger].icon
}))

/**
 * Opciones para select de acciones (para UI)
 */
export const WORKFLOW_ACTION_OPTIONS = WORKFLOW_ACTIONS.map(action => ({
    value: action,
    label: WORKFLOW_ACTION_META[action].label,
    description: WORKFLOW_ACTION_META[action].description,
    icon: WORKFLOW_ACTION_META[action].icon
}))
