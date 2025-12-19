/**
 * API de Pagos con Idempotencia
 * Resuelve: PAY-001 del reporte forense
 */

import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"
import crypto from "crypto"
import { getPaginationParams } from "@/lib/pagination"

function maskIdempotencyKey(value: string) {
    if (!value) return undefined
    if (value.length <= 8) return "[REDACTED]"
    return `${value.slice(0, 4)}...${value.slice(-4)}`
}

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        // Rate limit for sensitive data reading
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rateLimitResponse) return rateLimitResponse

        const searchParams = request.nextUrl.searchParams
        const invoice_id = searchParams.get('invoice_id')
        const status = searchParams.get('status')
        const { page, limit, offset } = getPaginationParams(searchParams)

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
        const log = createRequestLogger(request, organizationId)
        requestBody = await request.json()

        const { invoice_id, amount, payment_method, transaction_id, gateway, proof_url, notes, status } = requestBody

        if (!invoice_id || !amount || !gateway) {
            throw new ValidationError("Campos requeridos faltantes", { required: ['invoice_id', 'amount', 'gateway'] })
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw new ValidationError("El monto debe ser un número positivo")
        }

        const allowedGateways = ['stripe', 'bank_transfer', 'cash', 'yape', 'plin', 'mercadopago', 'manual']
        if (!allowedGateways.includes(gateway.toLowerCase())) {
            throw new ValidationError(`Gateway inválido. Permitidos: ${allowedGateways.join(', ')}`)
        }

        const allowedStatuses = ['pending', 'completed', 'failed', 'refunded']
        if (status && !allowedStatuses.includes(status)) {
            throw new ValidationError(`Estado inválido. Permitidos: ${allowedStatuses.join(', ')}`)
        }

        // ✅ FIX P1: Validate payment amount does not exceed invoice balance
        const { data: invoice, error: invoiceError } = await supabase
            .from('invoices')
            .select('total')
            .eq('id', invoice_id)
            .eq('organization_id', organizationId)
            .single()

        if (invoiceError || !invoice) {
            throw new ValidationError("Factura no encontrada")
        }

        const { data: existingPayments } = await supabase
            .from('payments')
            .select('amount')
            .eq('invoice_id', invoice_id)
            .eq('status', 'completed')

        const totalPaid = existingPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
        const remainingBalance = Number(invoice.total) - totalPaid

        if (amount > remainingBalance) {
            throw new ValidationError(
                `El monto del pago (${amount}) excede el saldo pendiente de la factura (${remainingBalance})`,
                {
                    invoice_total: invoice.total,
                    total_paid: totalPaid,
                    remaining_balance: remainingBalance,
                    payment_amount: amount
                }
            )
        }

        // ====================================================================
        // IDEMPOTENCIA: Prevenir pagos duplicados (Resuelve PAY-001)
        // ====================================================================

        // 1. Obtener o generar idempotency key
        // El cliente puede enviar su propia key en el header, o generamos una
        const idempotencyKey = request.headers.get('idempotency-key') ||
                              request.headers.get('x-idempotency-key') ||
                              `auto-${invoice_id}-${amount}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`

        log.info("Processing payment", { idempotency_key: maskIdempotencyKey(idempotencyKey) })

        // 2. Verificar si ya existe un pago con esta idempotency key
        const { data: existingPayment, error: existingError } = await supabase
            .from('payments')
            .select('*')
            .eq('idempotency_key', idempotencyKey)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (existingPayment) {
            // Pago ya procesado anteriormente, retornar el mismo resultado
            log.warn("Idempotent request detected. Returning cached payment", {
                paymentId: existingPayment.id,
                idempotency_key: maskIdempotencyKey(idempotencyKey),
            })

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
                payment_method: payment_method || null,
                gateway,
                transaction_id,
                status: status || (proof_url ? 'pending' : 'completed'),
                paid_at: (status === 'completed' || (!status && !proof_url)) ? new Date().toISOString() : null,
                proof_url: proof_url || null,
                notes: notes || null,
                idempotency_key: idempotencyKey
            })
            .select()
            .single()

        if (paymentError) {
            // 4. Manejar race conditions en idempotency_key
            if (paymentError.code === '23505' && paymentError.message?.includes('idempotency_key')) {
                log.warn("Race condition detected on idempotency_key, fetching existing payment", {
                    idempotency_key: maskIdempotencyKey(idempotencyKey),
                })

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

        log.info("New payment created", { paymentId: payment.id, idempotency_key: maskIdempotencyKey(idempotencyKey) })

        // 5. Update invoice status if fully paid (reuse previously fetched invoice and totalPaid)
        const totalPaidAmount = totalPaid + amount
        const isFullyPaid = totalPaidAmount >= Number(invoice.total)

        if (isFullyPaid && (payment.status === 'completed')) {
            await supabase.from('invoices').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', invoice_id)
            await supabase
                .from('quotes')
                .update({ status: 'paid', updated_at: new Date().toISOString() })
                .eq('invoice_id', invoice_id)
                .eq('organization_id', organizationId)
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
