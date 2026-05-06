import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { ticketSchema } from "@/lib/schemas"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { validatePagination } from "@/lib/auth-helpers"
import { validateTicketReferences } from "@/lib/work-item-references"
import { z } from "zod"
import crypto from "crypto"

const ticketFilterSchema = z.object({
    status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    account_id: z.string().uuid().optional(),
    contact_id: z.string().uuid().optional(),
    search: z.string().trim().max(100).optional(),
})

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const filters = ticketFilterSchema.safeParse({
            status: searchParams.get("status") || undefined,
            priority: searchParams.get("priority") || undefined,
            account_id: searchParams.get("account_id") || undefined,
            contact_id: searchParams.get("contact_id") || undefined,
            search: searchParams.get("search") || undefined,
        })

        if (!filters.success) {
            throw new ValidationError("Filtros inválidos", filters.error.format())
        }

        const { page, limit, offset } = validatePagination(searchParams)

        let query = supabase
            .from("tickets")
            .select("*, account:accounts(id, name), contact:contacts(id, name, email)", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (filters.data.status) query = query.eq("status", filters.data.status)
        if (filters.data.priority) query = query.eq("priority", filters.data.priority)
        if (filters.data.account_id) query = query.eq("account_id", filters.data.account_id)
        if (filters.data.contact_id) query = query.eq("contact_id", filters.data.contact_id)
        if (filters.data.search) query = query.ilike("title", `%${filters.data.search}%`)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/tickets", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = ticketSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        await validateTicketReferences(supabase, organizationId, validation.data)

        const { data, error } = await supabase
            .from("tickets")
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        // Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'ticket.created',
            source: 'api/tickets',
            payload: { ...data, user_id: user.id, organization_id: organizationId }
        }, supabase)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/tickets", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
