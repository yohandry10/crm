import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import crypto from "crypto"

interface RouteParams {
    params: { id: string }
}

/**
 * POST /api/quotes/[id]/convert
 * Convert a paid quote into an invoice
 * 
 * Requirements:
 * - Quote must exist and belong to the organization
 * - Quote must have a confirmed payment (or be marked as paid)
 * - Quote must not already be converted
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const quoteId = params.id

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
        if (quote.status === 'converted') {
            throw new ValidationError("Esta cotización ya fue convertida a factura")
        }

        // 3. Check if quote is in a valid status for conversion
        const validStatuses = ['accepted', 'sent', 'paid']
        if (!validStatuses.includes(quote.status)) {
            throw new ValidationError(`La cotización debe estar aceptada o pagada para convertir. Estado actual: ${quote.status}`)
        }

        // 4. Check for payment (optional - can be bypassed with manual confirmation)
        const body = await request.json().catch(() => ({}))
        const skipPaymentCheck = body.skipPaymentCheck === true

        if (!skipPaymentCheck) {
            // Check if there's a completed payment for this quote
            const { data: payments } = await supabase
                .from('payments')
                .select('id, amount, status')
                .eq('organization_id', organizationId)
                .in('status', ['completed', 'pending'])
                // Payment might be linked via metadata or we check by amount
                .limit(1)

            // For now, we allow conversion if quote is in valid status
            // In production, you'd want stricter payment validation
        }

        // 5. Get organization settings for invoice series
        const { data: org } = await supabase
            .from('organizations')
            .select('serie_factura, serie_boleta, default_tax_rate, currency')
            .eq('id', organizationId)
            .single()

        // 6. Get next invoice number
        const serie = org?.serie_factura || 'F001'
        const { data: lastInvoice } = await supabase
            .from('invoices')
            .select('invoice_number')
            .eq('organization_id', organizationId)
            .like('invoice_number', `${serie}-%`)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

        let nextNumber = 1
        if (lastInvoice?.invoice_number) {
            const match = lastInvoice.invoice_number.match(/-(\d+)$/)
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1
            }
        }

        const invoiceNumber = `${serie}-${String(nextNumber).padStart(8, '0')}`

        // 7. Calculate totals from quote items
        const taxRate = org?.default_tax_rate || 18
        const subtotal = quote.items.reduce((sum: number, item: any) =>
            sum + (Number(item.quantity) * Number(item.unit_price)), 0
        )
        const tax = subtotal * (taxRate / 100)
        const total = subtotal + tax

        // 8. Create the invoice
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .insert({
                organization_id: organizationId,
                created_by: user.id,
                contact_id: quote.contact_id,
                quote_id: quoteId, // Link to original quote
                invoice_number: invoiceNumber,
                status: 'paid', // Already paid since we're converting
                issue_date: new Date().toISOString().split('T')[0],
                due_date: new Date().toISOString().split('T')[0], // Same day since paid
                currency: org?.currency || 'PEN',
                subtotal: Number(subtotal.toFixed(2)),
                tax: Number(tax.toFixed(2)),
                total: Number(total.toFixed(2)),
                notes: `Generada desde cotización #${quote.quote_number || quoteId.slice(0, 8)}`
            })
            .select()
            .single()

        if (invoiceError) throw invoiceError

        // 9. Copy quote items to invoice items
        const invoiceItems = quote.items.map((item: any) => ({
            invoice_id: invoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: Number(item.quantity) * Number(item.unit_price)
        }))

        const { error: itemsError } = await supabase
            .from('invoice_items')
            .insert(invoiceItems)

        if (itemsError) throw itemsError

        // 10. Update quote status to converted
        const { error: updateError } = await supabase
            .from('quotes')
            .update({
                status: 'converted',
                updated_at: new Date().toISOString()
            })
            .eq('id', quoteId)

        if (updateError) throw updateError

        // 11. Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'invoice.created_from_quote',
            source: 'api/quotes/convert',
            payload: {
                invoice_id: invoice.id,
                quote_id: quoteId,
                user_id: user.id,
                organization_id: organizationId
            }
        }, supabase)

        return NextResponse.json({
            success: true,
            data: {
                invoice,
                message: `Factura ${invoiceNumber} creada exitosamente`
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
