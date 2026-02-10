import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from '@/lib/error-handler'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import crypto from 'crypto'

const quoteItemSchema = z.object({
    product_id: z.preprocess(
        (val) => (val === '' || val === 'none' ? null : val),
        z.string().uuid("ID de producto inválido").optional().nullable()
    ),
    description: z.string().min(1, "Descripción requerida"),
    quantity: z.coerce.number().positive("Cantidad debe ser positiva"),
    unit_price: z.coerce.number().min(0, "Precio no puede ser negativo")
})

const quoteSchema = z.object({
    contact_id: z.string().uuid("ID de contacto inválido"),
    opportunity_id: z.string().optional().nullable().transform(val => {
        if (!val || val === '' || val === 'none') return null
        return val
    }),
    valid_until: z.string().optional().nullable().transform(val => {
        if (!val || val === '') return null
        // Accept both date-only (YYYY-MM-DD) and full ISO datetime formats
        return val
    }),
    notes: z.string().max(1000).optional().nullable(),
    terms: z.string().max(2000).optional().nullable(),
    items: z.array(quoteItemSchema).min(1, "Se requiere al menos un item")
})

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const contact_id = searchParams.get('contact_id')
        const opportunity_id = searchParams.get('opportunity_id')
        const status = searchParams.get('status')

        let query = supabase
            .from('quotes')
            .select(`*, contact:contacts(id, name, email), items:quote_items(*)`)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })

        if (contact_id) query = query.eq('contact_id', contact_id)
        if (opportunity_id) query = query.eq('opportunity_id', opportunity_id)
        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/quotes", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    let requestBody: any = undefined
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const bodyText = await request.text()
        requestBody = bodyText ? JSON.parse(bodyText) : undefined
        const body = requestBody

        const validation = quoteSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { contact_id, opportunity_id, valid_until, notes, terms, items } = validation.data
        const total_amount = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unit_price)), 0)

        const { data: quote, error: quoteError } = await supabase
            .from('quotes')
            .insert({
                organization_id: organizationId, created_by: user.id,
                contact_id, opportunity_id, valid_until, notes, terms, total_amount, status: 'draft'
            })
            .select()
            .single()

        if (quoteError) throw quoteError

        const itemsWithQuoteId = items.map((item: any) => ({
            quote_id: quote.id, description: item.description, quantity: item.quantity,
            unit_price: item.unit_price, total: Number(item.quantity) * Number(item.unit_price),
            product_id: item.product_id || null,
        }))

        const { error: itemsError } = await supabase.from('quote_items').insert(itemsWithQuoteId)
        if (itemsError) throw itemsError

        // Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'quote.created',
            source: 'api/quotes',
            payload: { ...quote, user_id: user.id, organization_id: organizationId, items: itemsWithQuoteId }
        }, supabase)

        return NextResponse.json({ success: true, data: quote })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/quotes", method: "POST", error, requestBody })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
