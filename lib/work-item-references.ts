import { ValidationError } from "@/lib/error-handler"

type TaskReferences = {
    contact_id?: string | null
    workflow_id?: string | null
    assigned_to?: string | null
}

type TicketReferences = {
    account_id?: string | null
    contact_id?: string | null
    assigned_to?: string | null
}

type ConversationReferences = {
    contact_id?: string | null
    channel_id?: string | null
}

type OpportunityReferences = {
    contact_id?: string | null
    stage_id?: string | null
    assigned_to?: string | null
}

async function validateTenantRecord(
    supabase: any,
    organizationId: string,
    table: string,
    id: string | null | undefined,
    message: string
) {
    if (!id) return

    const { data, error } = await supabase
        .from(table)
        .select("id")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .maybeSingle()

    if (error) throw error
    if (!data) throw new ValidationError(message)
}

export async function validateActiveOrganizationMember(
    supabase: any,
    organizationId: string,
    userId?: string | null
) {
    if (!userId) return

    const { data, error } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle()

    if (error) throw error
    if (!data) {
        throw new ValidationError("El usuario asignado no existe o no pertenece a tu organización")
    }
}

export async function validateTaskReferences(
    supabase: any,
    organizationId: string,
    task: TaskReferences
) {
    await Promise.all([
        validateTenantRecord(
            supabase,
            organizationId,
            "contacts",
            task.contact_id,
            "El contacto seleccionado no existe o no pertenece a tu organización"
        ),
        validateTenantRecord(
            supabase,
            organizationId,
            "workflows",
            task.workflow_id,
            "El workflow seleccionado no existe o no pertenece a tu organización"
        ),
        validateActiveOrganizationMember(supabase, organizationId, task.assigned_to),
    ])
}

export async function validateTicketReferences(
    supabase: any,
    organizationId: string,
    ticket: TicketReferences
) {
    await Promise.all([
        validateTenantRecord(
            supabase,
            organizationId,
            "accounts",
            ticket.account_id,
            "La cuenta seleccionada no existe o no pertenece a tu organización"
        ),
        validateTenantRecord(
            supabase,
            organizationId,
            "contacts",
            ticket.contact_id,
            "El contacto seleccionado no existe o no pertenece a tu organización"
        ),
        validateActiveOrganizationMember(supabase, organizationId, ticket.assigned_to),
    ])
}

export async function validateConversationReferences(
    supabase: any,
    organizationId: string,
    conversation: ConversationReferences
) {
    await Promise.all([
        validateTenantRecord(
            supabase,
            organizationId,
            "contacts",
            conversation.contact_id,
            "El contacto seleccionado no existe o no pertenece a tu organización"
        ),
        validateTenantRecord(
            supabase,
            organizationId,
            "channels",
            conversation.channel_id,
            "El canal seleccionado no existe o no pertenece a tu organización"
        ),
    ])
}

export async function validateOpportunityReferences(
    supabase: any,
    organizationId: string,
    opportunity: OpportunityReferences
) {
    await Promise.all([
        validateTenantRecord(
            supabase,
            organizationId,
            "contacts",
            opportunity.contact_id,
            "El contacto seleccionado no existe o no pertenece a tu organización"
        ),
        validateTenantRecord(
            supabase,
            organizationId,
            "pipeline_stages",
            opportunity.stage_id,
            "La etapa seleccionada no existe o no pertenece a tu organización"
        ),
        validateActiveOrganizationMember(supabase, organizationId, opportunity.assigned_to),
    ])
}

export async function assertConversationInOrganization(
    supabase: any,
    organizationId: string,
    conversationId: string
) {
    const { data, error } = await supabase
        .from("conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("organization_id", organizationId)
        .maybeSingle()

    if (error) throw error
    if (!data) {
        throw new ValidationError("La conversación seleccionada no existe o no pertenece a tu organización")
    }
}
