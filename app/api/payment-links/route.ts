import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import crypto from "crypto"

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
        const body = await request.json()
        const { quote_id, invoice_id, expires_days = 30 } = body

        if (!quote_id && !invoice_id) {
            throw new ValidationError("Se requiere quote_id o invoice_id")
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex')
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + expires_days)

        const { data, error } = await supabase
            .from('public_payment_tokens')
            .insert({
                organization_id: organizationId,
                quote_id: quote_id || null,
                invoice_id: invoice_id || null,
                token,
                expires_at: expiresAt.toISOString(),
            })
            .select()
            .single()

        if (error) throw error

        const baseUrl = getAppBaseUrl(request)
        const paymentLink = `${baseUrl}/pay/${token}`

        return NextResponse.json({
            success: true,
            data: {
                token,
                link: paymentLink,
                expires_at: expiresAt.toISOString(),
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
        const quote_id = searchParams.get('quote_id')
        const invoice_id = searchParams.get('invoice_id')

        let query = supabase
            .from('public_payment_tokens')
            .select('*, quote:quotes(quote_number), invoice:invoices(invoice_number)')
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
        const { token_id } = await request.json()

        if (!token_id) {
            throw new ValidationError("token_id requerido")
        }

        const { error } = await supabase
            .from('public_payment_tokens')
            .update({ is_active: false })
            .eq('id', token_id)
            .eq('organization_id', organizationId)

        if (error) throw error

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
