import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import crypto from "crypto"
import { z } from "zod"

const paymentLinkSchema = z.object({
    quote_id: z.string().uuid().optional().nullable(),
    invoice_id: z.string().uuid().optional().nullable(),
    expires_days: z.coerce.number().int().min(1).max(365).default(30),
}).refine((value) => Boolean(value.quote_id) !== Boolean(value.invoice_id), {
    message: "Se requiere exactamente quote_id o invoice_id",
    path: ["quote_id"],
})

const paymentLinkQuerySchema = z.object({
    quote_id: z.string().uuid().optional(),
    invoice_id: z.string().uuid().optional(),
})

const deletePaymentLinkSchema = z.object({
    token_id: z.string().uuid(),
})

function getAppBaseUrl(request: NextRequest) {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
    if (configured) return configured.replace(/\/+$/, "")
    return request.nextUrl.origin
}

/**
 * POST /api/payment-links
 * Generate a public payment link for a quote or invoice
 */
export async function POST(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const validation = paymentLinkSchema.safeParse(await request.json().catch(() => null))

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "Datos inválidos", details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { quote_id, invoice_id, expires_days } = validation.data

        const { data: token, error } = await supabase
            .rpc('generate_payment_token', {
                p_organization_id: organizationId,
                p_quote_id: quote_id || null,
                p_invoice_id: invoice_id || null,
                p_expires_days: expires_days,
            })

        if (error) throw error
        if (!token || typeof token !== 'string') {
            throw new Error("No se pudo generar el enlace de pago")
        }

        const { data: createdToken } = await supabase
            .from('public_payment_tokens')
            .select('id, expires_at')
            .eq('organization_id', organizationId)
            .eq('token', token)
            .single()

        const baseUrl = getAppBaseUrl(request)
        const paymentLink = `${baseUrl}/pay/${token}`
        const fallbackExpiresAt = new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()

        return NextResponse.json({
            success: true,
            data: {
                id: createdToken?.id,
                token,
                link: paymentLink,
                expires_at: createdToken?.expires_at || fallbackExpiresAt,
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/payment-links",
            method: "POST",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

/**
 * GET /api/payment-links
 * List payment links for the organization
 */
export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const validation = paymentLinkQuerySchema.safeParse({
            quote_id: searchParams.get('quote_id') || undefined,
            invoice_id: searchParams.get('invoice_id') || undefined,
        })

        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "Filtros inválidos", details: validation.error.flatten() },
                { status: 400 }
            )
        }

        const { quote_id, invoice_id } = validation.data

        let query = supabase
            .from('public_payment_tokens')
            .select(`
                id, organization_id, quote_id, invoice_id, token, expires_at,
                is_active, accessed_at, access_count, created_at,
                quote:quotes(quote_number),
                invoice:invoices(invoice_number)
            `)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })

        if (quote_id) query = query.eq('quote_id', quote_id)
        if (invoice_id) query = query.eq('invoice_id', invoice_id)

        const { data, error } = await query.limit(50)

        if (error) throw error

        const baseUrl = getAppBaseUrl(request)
        const linksWithUrls = data.map(item => ({
            ...item,
            link: `${baseUrl}/pay/${item.token}`
        }))

        return NextResponse.json({ success: true, data: linksWithUrls })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/payment-links",
            method: "GET",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

/**
 * DELETE /api/payment-links
 * Deactivate a payment link
 */
export async function DELETE(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const validation = deletePaymentLinkSchema.safeParse(await request.json().catch(() => null))

        if (!validation.success) {
            throw new ValidationError("token_id requerido")
        }

        const { data, error } = await supabase
            .from('public_payment_tokens')
            .update({ is_active: false })
            .eq('id', validation.data.token_id)
            .eq('organization_id', organizationId)
            .select('id')
            .maybeSingle()

        if (error) throw error
        if (!data) {
            return NextResponse.json(
                { success: false, error: "Enlace no encontrado" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, message: "Enlace desactivado" })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/payment-links",
            method: "DELETE",
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
