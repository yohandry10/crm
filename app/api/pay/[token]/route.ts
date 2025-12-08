import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logError } from "@/lib/error-logging"
import crypto from "crypto"

// Public endpoint - no auth required, uses service role
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RouteParams {
    params: { token: string }
}

/**
 * GET /api/pay/[token]
 * Get quote/invoice details for public payment page
 * No authentication required - uses token validation
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const token = params.token

        if (!token || token.length < 32) {
            return NextResponse.json(
                { success: false, error: "Token inválido" },
                { status: 400 }
            )
        }

        // Find token and verify it's valid
        const { data: tokenData, error: tokenError } = await supabase
            .from('public_payment_tokens')
            .select(`
                *,
                quote:quotes(
                    *,
                    contact:contacts(id, name, email, phone, company),
                    items:quote_items(*)
                ),
                invoice:invoices(
                    *,
                    contact:contacts(id, name, email, phone, company),
                    items:invoice_items(*)
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

        // Update access stats
        await supabase
            .from('public_payment_tokens')
            .update({
                accessed_at: new Date().toISOString(),
                access_count: (tokenData.access_count || 0) + 1
            })
            .eq('id', tokenData.id)

        // Return quote or invoice data
        const document = tokenData.quote || tokenData.invoice
        const type = tokenData.quote ? 'quote' : 'invoice'

        return NextResponse.json({
            success: true,
            data: {
                type,
                document,
                organization: tokenData.organization,
                paymentMethods: {
                    yape: tokenData.organization?.yape_phone ? {
                        phone: tokenData.organization.yape_phone,
                        qrUrl: tokenData.organization.yape_qr_url
                    } : null,
                    plin: tokenData.organization?.plin_phone ? {
                        phone: tokenData.organization.plin_phone,
                        qrUrl: tokenData.organization.plin_qr_url
                    } : null,
                    bank: tokenData.organization?.bank_name ? {
                        name: tokenData.organization.bank_name,
                        account: tokenData.organization.bank_account,
                        cci: tokenData.organization.bank_cci,
                        holder: tokenData.organization.bank_holder
                    } : null
                }
            }
        })

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
        const token = params.token
        const body = await request.json()
        const { proof_url, payment_method, notes } = body

        if (!token || token.length < 32) {
            return NextResponse.json(
                { success: false, error: "Token inválido" },
                { status: 400 }
            )
        }

        if (!proof_url) {
            return NextResponse.json(
                { success: false, error: "Comprobante requerido" },
                { status: 400 }
            )
        }

        // Verify token
        const { data: tokenData, error: tokenError } = await supabase
            .from('public_payment_tokens')
            .select('*, quote:quotes(*), invoice:invoices(*)')
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

        const document = tokenData.quote || tokenData.invoice
        const organizationId = tokenData.organization_id

        // Create payment record with proof
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                organization_id: organizationId,
                contact_id: document.contact_id,
                invoice_id: tokenData.invoice_id,
                amount: document.total_amount || document.total,
                currency: document.currency || 'PEN',
                status: 'pending', // Pending verification
                payment_method: payment_method || 'transfer',
                gateway: 'manual',
                proof_url,
                proof_uploaded_at: new Date().toISOString(),
                metadata: {
                    source: 'public_payment_page',
                    token_id: tokenData.id,
                    notes
                }
            })
            .select()
            .single()

        if (paymentError) throw paymentError

        return NextResponse.json({
            success: true,
            data: {
                payment_id: payment.id,
                message: "Comprobante recibido. Será verificado pronto."
            }
        })

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
