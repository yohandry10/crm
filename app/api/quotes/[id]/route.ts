import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from '@/lib/error-handler'
import { requireCanManageRecord, requireRolePermission } from '@/lib/role-permissions'
import crypto from 'crypto'
import { z } from 'zod'

const quoteStatusSchema = z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired'])

const quoteItemSchema = z.object({
    product_id: z.preprocess(
        (val) => (val === '' || val === 'none' ? null : val),
        z.string().uuid("ID de producto inválido").optional().nullable()
    ),
    description: z.string().min(1, "Descripción requerida"),
    quantity: z.coerce.number().positive("Cantidad debe ser positiva"),
    unit_price: z.coerce.number().min(0, "Precio no puede ser negativo")
})

const editableQuoteSchema = z.object({
    contact_id: z.string().uuid("ID de contacto inválido"),
    opportunity_id: z.preprocess(
        (val) => (!val || val === '' || val === 'none' ? null : val),
        z.string().uuid("ID de oportunidad inválido").optional().nullable()
    ),
    valid_until: z.string().optional().nullable().transform(val => (!val || val === '') ? null : val),
    notes: z.string().max(1000).optional().nullable(),
    terms: z.string().max(2000).optional().nullable(),
    items: z.array(quoteItemSchema).min(1, "Se requiere al menos un item")
})

async function validateQuoteReferences(
    supabase: any,
    organizationId: string,
    contactId: string,
    opportunityId: string | null,
    items: Array<{ product_id?: string | null }>
) {
    const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id')
        .eq('id', contactId)
        .eq('organization_id', organizationId)
        .maybeSingle()

    if (contactError) throw contactError
    if (!contact) throw new ValidationError("El contacto seleccionado no existe o no pertenece a tu organización")

    if (opportunityId) {
        const { data: opportunity, error: opportunityError } = await supabase
            .from('opportunities')
            .select('id')
            .eq('id', opportunityId)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (opportunityError) throw opportunityError
        if (!opportunity) throw new ValidationError("La oportunidad seleccionada no existe o no pertenece a tu organización")
    }

    const productIds = [...new Set(items.map((item) => item.product_id).filter(Boolean))] as string[]
    if (productIds.length === 0) return

    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('organization_id', organizationId)
        .in('id', productIds)

    if (productsError) throw productsError
    if ((products || []).length !== productIds.length) {
        throw new ValidationError("Uno o más productos no existen o no pertenecen a tu organización")
    }
}

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
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "quotes", "can_update")
        const { id } = await params
        requestBody = await request.json()

        // Get current quote status
        const { data: currentQuote, error: fetchError } = await supabase
            .from('quotes')
            .select('status, contact_id, notes, invoice_id, created_by')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (fetchError) throw fetchError
        await requireCanManageRecord(supabase, { role, resource: "quotes", recordOwnerId: currentQuote.created_by, userId: user.id })

        const hasEditablePayload = Array.isArray(requestBody?.items)

        if (hasEditablePayload) {
            if (currentQuote.invoice_id || ['converted', 'paid'].includes(currentQuote.status)) {
                throw new ValidationError("No se puede editar una cotización ya facturada o pagada")
            }

            const validation = editableQuoteSchema.safeParse(requestBody)
            if (!validation.success) {
                throw new ValidationError("Datos inválidos", validation.error.format())
            }

            const { contact_id, opportunity_id, valid_until, notes, terms, items } = validation.data
            await validateQuoteReferences(supabase, organizationId, contact_id, opportunity_id ?? null, items)

            const total_amount = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0)

            const { data, error } = await supabase
                .from('quotes')
                .update({
                    contact_id,
                    opportunity_id: opportunity_id ?? null,
                    valid_until,
                    notes,
                    terms,
                    total_amount,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .eq('organization_id', organizationId)
                .select()
                .single()

            if (error) throw error

            const { error: deleteItemsError } = await supabase
                .from('quote_items')
                .delete()
                .eq('quote_id', id)

            if (deleteItemsError) throw deleteItemsError

            const itemsWithQuoteId = items.map((item) => ({
                quote_id: id,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: Number(item.quantity) * Number(item.unit_price),
                product_id: item.product_id || null,
            }))

            const { error: insertItemsError } = await supabase.from('quote_items').insert(itemsWithQuoteId)
            if (insertItemsError) throw insertItemsError

            return NextResponse.json({ success: true, data })
        }

        if (['converted', 'paid'].includes(requestBody?.status)) {
            throw new ValidationError("Usa el flujo de facturación o pagos para cambiar a ese estado")
        }

        const statusValidation = quoteStatusSchema.safeParse(requestBody?.status)
        if (!statusValidation.success) {
            throw new ValidationError("Estado de cotización inválido")
        }

        const status = statusValidation.data

        // Accepting a quote validates stock, but does not create an invoice.
        // Billing is an explicit action through /api/quotes/[id]/convert.
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
                    return NextResponse.json({
                        success: false,
                        error: stockError.message || 'No se pudo validar el stock de la cotización'
                    }, { status: 400 })
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
            }
        }

        const { data, error } = await supabase
            .from('quotes')
            .update({ status, updated_at: new Date().toISOString() })
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
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "quotes", "can_delete")
        const { id } = await params

        const { data: existingQuote } = await supabase
            .from('quotes')
            .select('created_by')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (!existingQuote) throw new ValidationError("Cotización no encontrada")
        await requireCanManageRecord(supabase, { role, resource: "quotes", recordOwnerId: existingQuote.created_by, userId: user.id })

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
