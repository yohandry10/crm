import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logError } from "@/lib/error-logging"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"
import { z } from "zod"

const tokenSchema = z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/)
const paymentProofSchema = z.object({
    proof_url: z.string().trim().url("URL de comprobante inválida").max(2048)
        .refine((value) => process.env.NODE_ENV !== "production" || new URL(value).protocol === "https:", {
            message: "El comprobante debe usar HTTPS",
        }),
    payment_method: z.enum(["transfer", "yape", "plin"]).default("transfer"),
    notes: z.string().trim().max(1000).optional().nullable(),
})

function getServiceClient() {
    return createSupabaseServiceClient()
}

function getAllowedOrigin(request: NextRequest): string | null {
    const allowed = (process.env.PUBLIC_PAY_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
    const origin = request.headers.get('origin')
    const hostOrigin = request.nextUrl.origin
    if (allowed.length === 0) return process.env.NODE_ENV === 'production' ? null : origin || hostOrigin
    if (origin && allowed.includes(origin)) return origin
    if (!origin && allowed.includes(hostOrigin)) return hostOrigin
    return null
}

interface RouteParams {
    params: Promise<{ token: string }>
}

type MaybeRelation<T> = T | T[] | null

type PublicPaymentOrganization = {
    id: string
    name: string | null
    logo_url: string | null
    phone: string | null
    email: string | null
    address: string | null
    yape_phone: string | null
    yape_qr_url: string | null
    plin_phone: string | null
    plin_qr_url: string | null
    bank_name: string | null
    bank_account: string | null
    bank_cci: string | null
    bank_holder: string | null
}

type PublicPaymentDocument = {
    id: string
    contact_id?: string | null
    quote_number?: string | null
    invoice_number?: string | null
    status?: string | null
    total_amount?: number | null
    total?: number | null
    currency?: string | null
    valid_until?: string | null
    issue_date?: string | null
    due_date?: string | null
    created_at?: string | null
    contact?: unknown
    items?: unknown
}

type PublicPaymentTokenDetails = {
    id: string
    organization_id: string
    quote_id: string | null
    invoice_id: string | null
    access_count: number | null
    quote: MaybeRelation<PublicPaymentDocument>
    invoice: MaybeRelation<PublicPaymentDocument>
    organization: MaybeRelation<PublicPaymentOrganization>
}

type PublicPaymentProofToken = Omit<PublicPaymentTokenDetails, "access_count" | "organization">

function normalizeRelation<T>(value: MaybeRelation<T> | undefined): T | null {
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
}

/**
 * GET /api/pay/[token]
 * Get quote/invoice details for public payment page
 * No authentication required - uses token validation
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const rate = await rateLimit(_request, RATE_LIMITS.sensitive)
        if (rate) return rate

        const allowedOrigin = getAllowedOrigin(_request)
        if (!allowedOrigin) {
            return NextResponse.json({ success: false, error: "Origin not allowed" }, { status: 403 })
        }

        const { token: rawToken } = await params
        const tokenResult = tokenSchema.safeParse(rawToken)
        if (!tokenResult.success) {
            return NextResponse.json(
                { success: false, error: "Token inválido" },
                { status: 400 }
            )
        }

        const token = tokenResult.data
        const supabase = getServiceClient()

        // Find token and verify it's valid
        const { data: tokenData, error: tokenError } = await supabase
            .from('public_payment_tokens')
            .select(`
                id, organization_id, quote_id, invoice_id, access_count,
                quote:quotes(
                    id, quote_number, status, total_amount, currency, valid_until, created_at,
                    contact:contacts(id, name, email, phone, company),
                    items:quote_items(id, description, quantity, unit_price, total)
                ),
                invoice:invoices(
                    id, invoice_number, status, issue_date, due_date, currency, total, created_at,
                    contact:contacts(id, name, email, phone, company),
                    items:invoice_items(id, description, quantity, unit_price, total)
                ),
                organization:organizations(
                    id, name, logo_url, phone, email, address,
                    yape_phone, yape_qr_url, plin_phone, plin_qr_url,
                    bank_name, bank_account, bank_cci, bank_holder
                )
            `)
            .eq('token', token)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .single()

        if (tokenError || !tokenData) {
            return NextResponse.json(
                { success: false, error: "Enlace inválido o expirado" },
                { status: 404 }
            )
        }

        const tokenRecord = tokenData as unknown as PublicPaymentTokenDetails

        // Update access stats
        await supabase
            .from('public_payment_tokens')
            .update({
                accessed_at: new Date().toISOString(),
                access_count: (tokenRecord.access_count || 0) + 1
            })
            .eq('id', tokenRecord.id)

        // Return quote or invoice data
        const quote = normalizeRelation(tokenRecord.quote)
        const invoice = normalizeRelation(tokenRecord.invoice)
        const organization = normalizeRelation(tokenRecord.organization)
        const document = quote || invoice
        const type = quote ? 'quote' : 'invoice'

        const response = NextResponse.json({
            success: true,
            data: {
                type,
                document,
                organization,
                paymentMethods: {
                    yape: organization?.yape_phone ? {
                        phone: organization.yape_phone,
                        qrUrl: organization.yape_qr_url
                    } : null,
                    plin: organization?.plin_phone ? {
                        phone: organization.plin_phone,
                        qrUrl: organization.plin_qr_url
                    } : null,
                    bank: organization?.bank_name ? {
                        name: organization.bank_name,
                        account: organization.bank_account,
                        cci: organization.bank_cci,
                        holder: organization.bank_holder
                    } : null
                }
            }
        })
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
        return response

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/pay/[token]",
            method: "GET",
            error
        })
        return NextResponse.json(
            { success: false, error: "Error interno" },
            { status: 500 }
        )
    }
}

/**
 * POST /api/pay/[token]
 * Submit payment proof for a quote/invoice
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rate) return rate

        const allowedOrigin = getAllowedOrigin(request)
        if (!allowedOrigin) {
            return NextResponse.json({ success: false, error: "Origin not allowed" }, { status: 403 })
        }

        const { token: rawToken } = await params
        const tokenResult = tokenSchema.safeParse(rawToken)
        if (!tokenResult.success) {
            return NextResponse.json(
                { success: false, error: "Token inválido" },
                { status: 400 }
            )
        }

        const token = tokenResult.data
        const supabase = getServiceClient()
        const body = paymentProofSchema.safeParse(await request.json())
        if (!body.success) {
            return NextResponse.json(
                { success: false, error: "Datos inválidos", details: body.error.flatten() },
                { status: 400 }
            )
        }

        const { proof_url, payment_method, notes } = body.data

        // Verify token
        const { data: tokenData, error: tokenError } = await supabase
            .from('public_payment_tokens')
            .select(`
                id, organization_id, quote_id, invoice_id,
                quote:quotes(id, contact_id, total_amount, currency),
                invoice:invoices(id, contact_id, total, currency)
            `)
            .eq('token', token)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString())
            .single()

        if (tokenError || !tokenData) {
            return NextResponse.json(
                { success: false, error: "Enlace inválido o expirado" },
                { status: 404 }
            )
        }

        const tokenRecord = tokenData as unknown as PublicPaymentProofToken
        const quote = normalizeRelation(tokenRecord.quote)
        const invoice = normalizeRelation(tokenRecord.invoice)
        const document = quote || invoice
        const organizationId = tokenRecord.organization_id

        if (!document) {
            return NextResponse.json(
                { success: false, error: "Documento de pago no encontrado" },
                { status: 404 }
            )
        }

        const amount = document.total_amount ?? document.total
        if (amount == null) {
            return NextResponse.json(
                { success: false, error: "Monto de pago no encontrado" },
                { status: 404 }
            )
        }

        // Create payment record with proof
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                organization_id: organizationId,
                contact_id: document.contact_id,
                invoice_id: tokenRecord.invoice_id,
                amount,
                currency: document.currency || 'PEN',
                status: 'pending', // Pending verification
                payment_method,
                gateway: 'manual',
                proof_url,
                proof_uploaded_at: new Date().toISOString(),
                metadata: {
                    source: 'public_payment_page',
                    token_id: tokenRecord.id,
                    notes
                }
            })
            .select()
            .single()

        if (paymentError) throw paymentError

        const response = NextResponse.json({
            success: true,
            data: {
                payment_id: payment.id,
                message: "Comprobante recibido. Será verificado pronto."
            }
        })
        response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
        return response

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/pay/[token]",
            method: "POST",
            error
        })
        return NextResponse.json(
            { success: false, error: "Error al enviar comprobante" },
            { status: 500 }
        )
    }
}

export async function OPTIONS(request: NextRequest) {
    const allowedOrigin = getAllowedOrigin(request)
    if (!allowedOrigin) return new NextResponse(null, { status: 403 })

    const response = new NextResponse(null, { status: 204 })
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    return response
}
