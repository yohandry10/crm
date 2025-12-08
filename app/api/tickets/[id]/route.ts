import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { ticketSchema } from "@/lib/schemas"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

const WRITE_LIMIT = RATE_LIMITS.write

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params
        const body = await request.json()

        const validation = ticketSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.format() }, { status: 400 })
        }

        const { data, error } = await supabase
            .from("tickets")
            .update(validation.data)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tickets/[id]`,
            method: "PUT",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
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
