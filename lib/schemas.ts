import { z } from 'zod'

// =====================================================
// CONTACT SCHEMAS
// =====================================================

export const createContactSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email").optional().nullable().or(z.literal('')),
    phone: z.string().min(1, "Phone is required"),
    ruc: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    position: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().default('Lima'),
    country: z.string().default('Perú'),
    lead_score: z.number().min(0).max(100).default(0),
    lead_status: z.enum(['cold', 'warm', 'hot', 'converted', 'lost']).default('cold'),
    source: z.string().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),
    notes: z.string().optional().nullable(),
    role: z.string().optional(), // From validations.ts
    status: z.enum(["active", "inactive", "lead"]).optional() // From validations.ts
})

export const updateContactSchema = createContactSchema.partial()

// Legacy export for backward compatibility if needed, but prefer createContactSchema
export const contactSchema = createContactSchema

// =====================================================
// INVOICE SCHEMAS
// =====================================================

export const invoiceItemSchema = z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.number().positive("Quantity must be positive"),
    unit_price: z.number().nonnegative("Unit price must be non-negative"),
    tax_rate: z.number().min(0).default(0.18) // Added from validations.ts
})

export const createInvoiceSchema = z.object({
    contact_id: z.string().uuid("Invalid contact ID"),
    invoice_number: z.string().optional(),
    status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).default('draft'),
    issue_date: z.string().or(z.date()).optional().default(() => new Date().toISOString().split('T')[0]),
    due_date: z.string().or(z.date()),
    currency: z.enum(['PEN', 'USD']).default('PEN'),
    notes: z.string().optional().nullable(),
    items: z.array(invoiceItemSchema).min(1, "At least one item is required")
})

export const updateInvoiceSchema = createInvoiceSchema.partial()

// Legacy export
export const invoiceSchema = createInvoiceSchema

// =====================================================
// PAYMENT SCHEMAS
// =====================================================

export const createPaymentSchema = z.object({
    contact_id: z.string().uuid().optional().nullable(),
    invoice_id: z.string().uuid().optional().nullable(),
    amount: z.number().positive("Amount must be positive"),
    currency: z.string().default('PEN'),
    payment_method: z.enum(['card', 'transfer', 'cash', 'yape', 'plin']).optional(), // Merged enums
    gateway: z.enum(['stripe', 'mercadopago', 'manual']).default('manual'),
    metadata: z.record(z.any()).optional().default({}),
    transaction_id: z.string().optional(), // From validations.ts
    notes: z.string().optional() // From validations.ts
})

export const updatePaymentSchema = z.object({
    status: z.enum(['pending', 'completed', 'failed', 'refunded']).optional(),
    paid_at: z.string().or(z.date()).optional(),
    metadata: z.record(z.any()).optional()
})

// Legacy export
export const paymentSchema = createPaymentSchema

// =====================================================
// WORKFLOW SCHEMAS
// =====================================================

export const workflowActionSchema = z.object({
    type: z.enum(['send_email', 'update_lead_score', 'update_lead_status', 'create_task', 'webhook']),
    params: z.record(z.any())
})

export const createWorkflowSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional().nullable(),
    // ✅ CORREGIDO: Usar notación con punto para coincidir con el sistema de eventos
    trigger_type: z.enum([
        'contact.created',
        'contact.updated',
        'invoice.sent',
        'invoice.paid',
        'payment.completed',
        'opportunity.created',
        'opportunity.updated',
        'task.created',
        'task.completed',
        'ticket.created',
        'ticket.resolved',
        'campaign.created',
        'quote.created',
        'manual',
        'schedule'
    ]),
    trigger_conditions: z.record(z.any()).optional(),
    actions: z.array(workflowActionSchema).min(1, "At least one action is required"),
    is_active: z.boolean().default(true)
})

export const updateWorkflowSchema = createWorkflowSchema.partial()

export const executeWorkflowSchema = z.object({
    workflow_id: z.string().uuid("Invalid workflow ID"),
    contact_id: z.string().uuid("Invalid contact ID").optional(),
    manual_trigger: z.boolean().default(false)
})

// Legacy export
export const workflowSchema = createWorkflowSchema

// =====================================================
// TASK SCHEMA
// =====================================================

export const taskSchema = z.object({
    title: z.string().min(1, "Título requerido").max(255),
    description: z.string().optional().nullable(),
    contact_id: z.string().uuid().optional().nullable(),
    workflow_id: z.string().uuid().optional().nullable(),
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]).default("pending"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    due_date: z.string().optional().nullable(),
    completed_at: z.string().optional().nullable(),
    assigned_to: z.string().uuid().optional().nullable(),
    metadata: z.record(z.any()).optional().default({})
})

// =====================================================
// ACCOUNTS / TICKETS / SALES ORDERS
// =====================================================

export const accountSchema = z.object({
    name: z.string().min(1, "Nombre de empresa requerido"),
    ruc: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    website: z.string().url().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    metadata: z.record(z.any()).optional().default({})
})

export const ticketSchema = z.object({
    account_id: z.string().uuid().optional().nullable(),
    contact_id: z.string().uuid().optional().nullable(),
    title: z.string().min(1, "Título requerido"),
    description: z.string().optional().nullable(),
    status: z.enum(['open', 'in_progress', 'waiting', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assigned_to: z.string().uuid().optional().nullable(),
    sla_due_at: z.string().datetime().optional().nullable(),
    tags: z.array(z.string()).optional().default([]),
    metadata: z.record(z.any()).optional().default({})
})

export const salesOrderSchema = z.object({
    account_id: z.string().uuid().optional().nullable(),
    contact_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    status: z.enum(['draft', 'confirmed', 'fulfilled', 'cancelled', 'completed']).optional(),
    currency: z.string().default('PEN'),
    subtotal: z.number().nonnegative().default(0),
    tax: z.number().nonnegative().default(0),
    total: z.number().nonnegative().default(0),
    notes: z.string().optional().nullable(),
    metadata: z.record(z.any()).optional().default({})
})

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
    return schema.parse(data)
}

export function safeValidateRequest<T>(schema: z.ZodSchema<T>, data: unknown): {
    success: boolean
    data?: T
    error?: z.ZodError
} {
    const result = schema.safeParse(data)
    if (result.success) {
        return { success: true, data: result.data }
    }
    return { success: false, error: result.error }
}


// =====================================================
// ORGANIZATION SCHEMAS (MULTI-TENANT)
// =====================================================

export const createOrganizationSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(100),
    slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Solo letras minúsculas, números y guiones").optional(),
    ruc: z.string().optional().nullable(),
    legal_name: z.string().optional().nullable(),
    industry: z.string().optional().nullable(),
    website: z.string().url().optional().or(z.literal('')).nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().or(z.literal('')).nullable(),
    address: z.string().optional().nullable(),
    city: z.string().default('Lima'),
    country: z.string().default('Perú'),
    timezone: z.string().default('America/Lima'),
    currency: z.enum(['PEN', 'USD']).default('PEN'),
})

export const updateOrganizationSchema = createOrganizationSchema.partial()

export const inviteMemberSchema = z.object({
    email: z.string().email("Email inválido"),
    role: z.enum(['admin', 'manager', 'member', 'viewer']).default('member'),
    message: z.string().optional().nullable(),
})

export const updateMemberSchema = z.object({
    role: z.enum(['admin', 'manager', 'member', 'viewer']).optional(),
    job_title: z.string().optional().nullable(),
    department: z.string().optional().nullable(),
    is_active: z.boolean().optional(),
})
