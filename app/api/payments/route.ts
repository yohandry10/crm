/**
 * API de Pagos con Idempotencia
 * Resuelve: PAY-001 del reporte forense
 */

import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        // Rate limit for sensitive data reading
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rateLimitResponse) return rateLimitResponse

        const searchParams = request.nextUrl.searchParams
        const invoice_id = searchParams.get('invoice_id')
        const status = searchParams.get('status')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const offset = (page - 1) * limit

        let query = supabase
            .from('payments')
            .select(`*, invoice:invoices(invoice_number, total, status), contact:contacts(name, email)`, { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (invoice_id) query = query.eq('invoice_id', invoice_id)
        if (status) query = query.eq('status', status)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/payments", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    let requestBody: any
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        requestBody = await request.json()

        const { invoice_id, amount, payment_method, transaction_id, gateway } = requestBody

        if (!invoice_id || !amount || !payment_method || !gateway) {
            throw new ValidationError("Campos requeridos faltantes", { required: ['invoice_id', 'amount', 'payment_method', 'gateway'] })
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw new ValidationError("El monto debe ser un número positivo")
        }

        const allowedGateways = ['stripe', 'bank_transfer', 'cash', 'yape', 'plin', 'mercadopago', 'manual']
        if (!allowedGateways.includes(gateway.toLowerCase())) {
            throw new ValidationError(`Gateway inválido. Permitidos: ${allowedGateways.join(', ')}`)
        }

        // ====================================================================
        // IDEMPOTENCIA: Prevenir pagos duplicados (Resuelve PAY-001)
        // ====================================================================

        // 1. Obtener o generar idempotency key
        // El cliente puede enviar su propia key en el header, o generamos una
        const idempotencyKey = request.headers.get('idempotency-key') ||
                              request.headers.get('x-idempotency-key') ||
                              `auto-${invoice_id}-${amount}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`

        console.log(`💳 Processing payment with idempotency key: ${idempotencyKey}`)

        // 2. Verificar si ya existe un pago con esta idempotency key
        const { data: existingPayment, error: existingError } = await supabase
            .from('payments')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (existingPayment) {
            // Pago ya procesado anteriormente, retornar el mismo resultado
            console.log(`⚠️ Idempotent request detected. Returning cached payment: ${existingPayment.id}`)

            // Obtener info de la factura para la respuesta
            const { data: invoice } = await supabase
                .from('invoices')
                .select('total, status')
                .eq('id', invoice_id)
                .single()

            return NextResponse.json({
                success: true,
                data: {
                    payment_id: existingPayment.id,
                    is_fully_paid: invoice?.status === 'paid',
                    total_paid: existingPayment.amount
                },
                message: 'Pago ya procesado anteriormente',
                cached: true,
                idempotency_key: idempotencyKey
            })
        }

        // 3. MULTI-TENANT: Insert with organization_id + idempotency_key
        const { data: payment, error: paymentError } = await supabase
            .from('payments')
            .insert({
                organization_id: organizationId,
                created_by: user.id,
                invoice_id,
                amount,
                payment_method,
                gateway,
                transaction_id,
                status: 'completed',
                paid_at: new Date().toISOString(),
                idempotency_key: idempotencyKey
            })
            .select()
            .single()

        if (paymentError) {
            // 4. Manejar race conditions en idempotency_key
            if (paymentError.code === '23505' && paymentError.message?.includes('idempotency_key')) {
                console.log('⚠️ Race condition detected on idempotency_key, fetching existing payment')

                // Intentar obtener el pago que ganó la race condition
                const { data: racedPayment } = await supabase
                    .from('payments')
                    .select('*')
                    .eq('idempotency_key', idempotencyKey)
                    .eq('organization_id', organizationId)
                    .single()

                if (racedPayment) {
                    const { data: invoice } = await supabase
                        .from('invoices')
                        .select('total, status')
                        .eq('id', invoice_id)
                        .single()

                    return NextResponse.json({
                        success: true,
                        data: {
                            payment_id: racedPayment.id,
                            is_fully_paid: invoice?.status === 'paid',
                            total_paid: racedPayment.amount
                        },
                        message: 'Pago procesado (race condition handled)',
                        cached: true,
                        idempotency_key: idempotencyKey
                    })
                }
            }
            throw paymentError
        }

        console.log(`✅ New payment created: ${payment.id}`)

        // 5. Update invoice status if fully paid
        const { data: invoice } = await supabase
            .from('invoices')
            .select('total')
            .eq('id', invoice_id)
            .single()

        const { data: totalPaid } = await supabase
            .from('payments')
            .select('amount')
            .eq('invoice_id', invoice_id)
            .eq('status', 'completed')

        const totalPaidAmount = totalPaid?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
        const isFullyPaid = totalPaidAmount >= Number(invoice?.total || 0)

        if (isFullyPaid) {
            await supabase.from('invoices').update({ status: 'paid' }).eq('id', invoice_id)
        }

        // 6. Emit event
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'payment.completed', source: 'internal',
            payload: {
                payment_id: payment.id,
                organization_id: organizationId,
                user_id: user.id,
                invoice_id,
                amount,
                gateway,
                idempotency_key: idempotencyKey
            }
        }, supabase as any)

        return NextResponse.json({
            success: true,
            data: { payment_id: payment.id, is_fully_paid: isFullyPaid, total_paid: totalPaidAmount },
            message: isFullyPaid ? 'Pago completado - Factura pagada' : 'Pago registrado',
            idempotency_key: idempotencyKey
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/payments", method: "POST", error, requestBody })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
