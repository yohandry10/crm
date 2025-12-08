import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { contactSchema } from "@/lib/schemas"
import crypto from "crypto"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
    const { id } = await context.params
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (error) {
            if (error.code === "PGRST116") return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 })
            throw error
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: `/api/contacts/${id}`, method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PUT(request: NextRequest, context: RouteContext) {
    const { id } = await context.params
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = contactSchema.partial().safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Validation failed", details: validation.error.errors }, { status: 400 })
        }

        const { data: oldData } = await supabase.from("contacts").select("*").eq("id", id).eq("organization_id", organizationId).single()
        if (!oldData) return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 })

        const { data, error } = await supabase
            .from("contacts")
            .update({ ...validation.data, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "UPDATE_CONTACT", table: "contacts", recordId: id, oldData, newData: data })

        if ((oldData.lead_status !== data.lead_status) || (oldData.lead_score !== data.lead_score)) {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'contact.updated', source: 'internal',
                payload: { id: data.id, organization_id: organizationId, user_id: user.id, old_status: oldData.lead_status, new_status: data.lead_status, old_score: oldData.lead_score, new_score: data.lead_score }
            }, supabase as any)
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: `/api/contacts/${id}`, method: "PUT", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    const { id } = await context.params
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()

        const { data: oldData } = await supabase.from("contacts").select("*").eq("id", id).eq("organization_id", organizationId).single()
        if (!oldData) return NextResponse.json({ success: false, error: "Contact not found" }, { status: 404 })

        const { error } = await supabase.from("contacts").delete().eq("id", id).eq("organization_id", organizationId)
        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "DELETE_CONTACT", table: "contacts", recordId: id, oldData })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: `/api/contacts/${id}`, method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
