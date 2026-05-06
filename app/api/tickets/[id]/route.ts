import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { ticketSchema } from "@/lib/schemas"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, NotFoundError, ValidationError } from "@/lib/error-handler"
import { validateTicketReferences } from "@/lib/work-item-references"
import { requireRolePermission } from "@/lib/role-permissions"
import crypto from "crypto"

const WRITE_LIMIT = RATE_LIMITS.write
const updateTicketSchema = ticketSchema.partial()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from("tickets")
            .select("*, account:accounts(id, name), contact:contacts(id, name, email)")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle()

        if (error) throw error
        if (!data) throw new NotFoundError("Ticket", id)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tickets/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

async function updateTicket(request: NextRequest, { params }: { params: Promise<{ id: string }> }, method: "PUT" | "PATCH") {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "tickets", "can_update")
        const { id } = await params
        const body = await request.json()

        const validation = updateTicketSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        if (Object.keys(validation.data).length === 0) {
            throw new ValidationError("Se requiere al menos un campo para actualizar")
        }

        await validateTicketReferences(supabase, organizationId, validation.data)

        const { data, error } = await supabase
            .from("tickets")
            .update(validation.data)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .maybeSingle()

        if (error) throw error
        if (!data) throw new NotFoundError("Ticket", id)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tickets/[id]`,
            method,
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return updateTicket(request, context, "PUT")
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return updateTicket(request, context, "PATCH")
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "tickets", "can_delete")
        const { id } = await params

        const { error } = await supabase
            .from("tickets")
            .delete()
            .eq("id", id)
            .eq("organization_id", organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tickets/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
