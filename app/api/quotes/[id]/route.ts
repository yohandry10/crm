import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import crypto from 'crypto'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from('quotes')
            .select(`
                *,
                contact:contacts(id, name, email, phone, address),
                items:quote_items(*)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/quotes/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let requestBody: any
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const { id } = await params
        requestBody = await request.json()

        const { status } = requestBody

        // Get current quote status
        const { data: currentQuote, error: fetchError } = await supabase
            .from('quotes')
            .select('status, contact_id, notes')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (fetchError) throw fetchError

        // Check if status is changing to 'accepted'
        if (status === 'accepted' && currentQuote.status !== 'accepted') {
            // Fetch quote items
            const { data: quoteItems, error: itemsError } = await supabase
                .from('quote_items')
                .select('*')
                .eq('quote_id', id)

            if (itemsError) throw itemsError

            if (quoteItems && quoteItems.length > 0) {
                // ✅ FIX: Verificar stock disponible antes de aceptar
                const { data: stockCheck, error: stockError } = await supabase
                    .rpc('check_quote_stock_availability', { p_quote_id: id })

                if (stockError) {
                    console.warn('Stock check failed, continuing without validation:', stockError)
                } else if (stockCheck && stockCheck.length > 0) {
                    const outOfStock = stockCheck.filter((item: any) => !item.has_stock)
                    if (outOfStock.length > 0) {
                        const itemNames = outOfStock.map((i: any) =>
                            `${i.product_name} (necesita: ${i.required_quantity}, disponible: ${i.available_quantity})`
                        ).join(', ')

                        return NextResponse.json({
                            success: false,
                            error: `Stock insuficiente para: ${itemNames}`,
                            details: outOfStock
                        }, { status: 400 })
                    }
                }

                // Map quote items to invoice items
                const invoiceItems = quoteItems.map(item => ({
                    description: item.description,
                    quantity: item.quantity,
                    unit_price: item.unit_price
                }))

                // Create invoice using atomic RPC - MULTI-TENANT
                const { data: invoiceData, error: invoiceError } = await supabase
                    .rpc('create_invoice_with_items_atomic', {
                        p_org_id: organizationId,
                        p_user_id: user.id,
                        p_contact_id: currentQuote.contact_id,
                        p_items: invoiceItems,
                        p_due_date: null,
                        p_notes: `Creado desde cotización: ${currentQuote.notes || ''}`
                    })
                    .single()

                if (invoiceError) {
                    console.error("Error creating invoice from quote:", invoiceError)
                    throw new Error(`Error creating invoice: ${invoiceError.message}`)
                }

                // Update quote with new status AND invoice_id
                const { data, error } = await supabase
                    .from('quotes')
                    .update({
                        status,
                        invoice_id: (invoiceData as any).invoice_id
                    })
                    .eq('id', id)
                    .eq('organization_id', organizationId)
                    .select()
                    .single()

                if (error) throw error
                return NextResponse.json({ success: true, data })
            }
        }

        // Normal update if not accepted or no items
        const { data, error } = await supabase
            .from('quotes')
            .update({ status })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/quotes/[id]`,
            method: "PATCH",
            error,
            requestBody,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { error } = await supabase
            .from('quotes')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/quotes/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
