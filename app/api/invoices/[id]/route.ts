import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params

        const { data: invoice, error } = await supabase
            .from("invoices")
            .select(`*, contact:contacts(id, name, email, company, ruc), items:invoice_items(*)`)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (error) {
            if (error.code === "PGRST116") return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
            throw error
        }

        return NextResponse.json({ success: true, data: invoice })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: `/api/invoices/[id]`, method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params
        const body = await request.json()

        const { data: oldData } = await supabase
            .from("invoices")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (!oldData) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })

        if (body.status) {
            const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
            if (!validStatuses.includes(body.status)) {
                return NextResponse.json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
            }
            if (oldData.status === 'paid' && body.status !== 'paid') {
                return NextResponse.json({ success: false, error: "Cannot change status of paid invoice" }, { status: 400 })
            }
        }

        const { data, error } = await supabase
            .from("invoices")
            .update({ ...body, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "UPDATE_INVOICE", table: "invoices", recordId: id, oldData, newData: data })

        if (body.status && body.status !== oldData.status && body.status === 'sent') {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'invoice.sent', source: 'internal',
                payload: { id: data.id, organization_id: organizationId, user_id: user.id, invoice_number: data.invoice_number, contact_id: data.contact_id, total: data.total }
            }, supabase as any)
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: `/api/invoices/[id]`, method: "PATCH", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PUT(request: NextRequest, context: RouteContext) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params
        const body = await request.json()

        // Get current invoice
        const { data: oldData } = await supabase
            .from("invoices")
            .select("*, items:invoice_items(*)")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (!oldData) {
            return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
        }

        // Only allow editing draft invoices
        if (oldData.status !== 'draft') {
            return NextResponse.json({ success: false, error: "Solo se pueden editar facturas en borrador" }, { status: 400 })
        }

        const { contact_id, due_date, notes, items } = body

        // Calculate totals
        const subtotal = items.reduce((sum: number, item: any) => 
            sum + (Number(item.quantity) * Number(item.unit_price)), 0
        )
        const tax = subtotal * 0.18
        const total = subtotal + tax

        // Update invoice
        const { error: invoiceError } = await supabase
            .from("invoices")
            .update({
                contact_id,
                due_date,
                notes: notes || null,
                subtotal,
                tax,
                total,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (invoiceError) throw invoiceError

        // Delete old items
        await supabase
            .from("invoice_items")
            .delete()
            .eq("invoice_id", id)

        // Insert new items
        const itemsToInsert = items.map((item: any) => ({
            invoice_id: id,
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            total: Number(item.quantity) * Number(item.unit_price)
        }))

        const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(itemsToInsert)

        if (itemsError) throw itemsError

        // Get updated invoice with items
        const { data: finalInvoice } = await supabase
            .from("invoices")
            .select("*, contact:contacts(id, name, email), items:invoice_items(*)")
            .eq("id", id)
            .single()

        await logAudit({ 
            supabase, request, userId: user.id, organizationId, 
            action: "UPDATE_INVOICE", table: "invoices", recordId: id, 
            oldData, newData: finalInvoice 
        })

        return NextResponse.json({ success: true, data: finalInvoice })
    } catch (error: any) {
        await logError({ 
            errorId: crypto.randomUUID(), 
            endpoint: `/api/invoices/[id]`, 
            method: "PUT", 
            error, 
            requestBody: await request.clone().json().catch(() => undefined) 
        })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params

        const { data: invoice } = await supabase
            .from("invoices")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (!invoice) return NextResponse.json({ success: false, error: "Invoice not found" }, { status: 404 })
        if (invoice.status === 'paid') return NextResponse.json({ success: false, error: "Cannot delete paid invoice" }, { status: 400 })

        const { error } = await supabase.from("invoices").delete().eq("id", id).eq("organization_id", organizationId)
        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "DELETE_INVOICE", table: "invoices", recordId: id, oldData: invoice })

        return NextResponse.json({ success: true, message: "Invoice deleted successfully" })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: `/api/invoices/[id]`, method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
