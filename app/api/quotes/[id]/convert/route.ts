import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { requireRolePermission } from "@/lib/role-permissions"
import crypto from "crypto"

interface RouteParams {
    params: Promise<{ id: string }>
}

/**
 * POST /api/quotes/[id]/convert
 * Convert a quote into an invoice (draft) and link it back to the quote.
 * 
 * Requirements:
 * - Quote must exist and belong to the organization
 * - Quote must not already be converted
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "invoices", "can_create")
        await requireRolePermission(supabase, role, "quotes", "can_update")
        const { id: quoteId } = await params

        if (!quoteId) {
            throw new ValidationError("ID de cotización requerido")
        }

        // 1. Get the quote with its items
        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .select(`
                *,
                contact:contacts(id, name, email, ruc, company, address),
                items:quote_items(*)
            `)
            .eq('id', quoteId)
            .eq('organization_id', organizationId)
            .single()

        if (quoteError || !quote) {
            throw new ValidationError("Cotización no encontrada")
        }

        // 2. Check if quote is already converted
        if (quote.status === 'converted' || quote.invoice_id) {
            throw new ValidationError("Esta cotización ya fue convertida a factura")
        }

        // 3. Check if quote is in a valid status for conversion
        const validStatuses = ['accepted', 'sent', 'paid']
        if (!validStatuses.includes(quote.status)) {
            throw new ValidationError(`La cotización debe estar aceptada o pagada para convertir. Estado actual: ${quote.status}`)
        }

        // Create invoice via atomic RPC (keeps numbering consistent and can decrement stock when product_id is present)
        const invoiceItems = (quote.items || []).map((item: any) => ({
            product_id: item.product_id || null,
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
        }))

        if (!invoiceItems.length) {
            throw new ValidationError("La cotización no tiene items")
        }

        const { data: invoiceData, error: invoiceError } = await supabase
            .rpc('create_invoice_with_items_atomic', {
                p_org_id: organizationId,
                p_user_id: user.id,
                p_contact_id: quote.contact_id,
                p_items: invoiceItems,
                p_due_date: null,
                p_notes: `Creado desde cotización: ${quote.quote_number || quoteId}`,
            })
            .single()

        if (invoiceError) throw invoiceError

        const newInvoiceId = (invoiceData as any)?.invoice_id
        if (!newInvoiceId) throw new Error("No se pudo crear la factura")

        // Update quote status to converted + link invoice_id
        const { error: updateError } = await supabase
            .from('quotes')
            .update({ status: 'converted', invoice_id: newInvoiceId, updated_at: new Date().toISOString() })
            .eq('id', quoteId)
            .eq('organization_id', organizationId)

        if (updateError) throw updateError

        // 11. Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'invoice.created_from_quote',
            source: 'api/quotes/convert',
            payload: {
                invoice_id: newInvoiceId,
                quote_id: quoteId,
                user_id: user.id,
                organization_id: organizationId
            }
        }, supabase)

        return NextResponse.json({
            success: true,
            data: {
                invoice_id: newInvoiceId,
                invoice_number: (invoiceData as any)?.invoice_number,
                message: `Factura ${(invoiceData as any)?.invoice_number || ''} creada exitosamente`
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/quotes/[id]/convert",
            method: "POST",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
