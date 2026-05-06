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
import { getAllowedPaymentGateways, normalizePaymentGateway } from "@/lib/billing-providers"
import { requireRolePermission } from "@/lib/role-permissions"

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

        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "payments", "can_create")
        const log = createRequestLogger(request, organizationId)
        requestBody = await request.json()

        const { invoice_id, amount, payment_method, transaction_id, gateway, proof_url, notes, status } = requestBody

        if (!invoice_id || !amount || !gateway) {
            throw new ValidationError("Campos requeridos faltantes", { required: ['invoice_id', 'amount', 'gateway'] })
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw new ValidationError("El monto debe ser un número positivo")
        }

        const normalizedGateway = normalizePaymentGateway(gateway)
        const allowedGateways = getAllowedPaymentGateways()
        if (!normalizedGateway || !allowedGateways.includes(normalizedGateway)) {
            throw new ValidationError(`Gateway inválido. Permitidos: ${allowedGateways.join(', ')}`)
        }

        const allowedStatuses = ['pending', 'completed', 'failed', 'refunded']
        if (status && !allowedStatuses.includes(status)) {
            throw new ValidationError(`Estado inválido. Permitidos: ${allowedStatuses.join(', ')}`)
        }

        const idempotencyKey = request.headers.get('idempotency-key') ||
                              request.headers.get('x-idempotency-key') ||
                              `auto-${invoice_id}-${amount}-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`

        if (idempotencyKey.length < 16 || idempotencyKey.length > 255) {
            throw new ValidationError("Idempotency key inválida: debe tener entre 16 y 255 caracteres")
        }

        log.info("Processing payment", { idempotency_key: maskIdempotencyKey(idempotencyKey) })

        const { data: rpcResult, error: rpcError } = await supabase.rpc('record_payment_atomic', {
            p_user_id: user.id,
            p_organization_id: organizationId,
            p_invoice_id: invoice_id,
            p_amount: amount,
            p_payment_method: payment_method || null,
            p_gateway: normalizedGateway,
            p_transaction_id: transaction_id || null,
            p_proof_url: proof_url || null,
            p_notes: notes || null,
            p_status: status || null,
            p_idempotency_key: idempotencyKey,
        })

        if (rpcError) throw rpcError
        if (!rpcResult?.success) {
            throw new ValidationError(rpcResult?.error || "No se pudo registrar el pago", rpcResult)
        }

        const paymentStatus = rpcResult.status || status || (proof_url ? 'pending' : 'completed')
        const isFullyPaid = Boolean(rpcResult.is_fully_paid)
        const totalPaidAmount = Number(rpcResult.total_paid || 0)
        log.info("Payment recorded", {
            paymentId: rpcResult.payment_id,
            cached: Boolean(rpcResult.cached),
            idempotency_key: maskIdempotencyKey(idempotencyKey),
        })

        if (paymentStatus === 'completed') {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'payment.completed', source: 'internal',
                payload: {
                    payment_id: rpcResult.payment_id,
                    organization_id: organizationId,
                    user_id: user.id,
                    invoice_id,
                    amount,
                    gateway: normalizedGateway,
                    idempotency_key: idempotencyKey
                }
            }, supabase as any)
        }

        return NextResponse.json({
            success: true,
            data: { payment_id: rpcResult.payment_id, is_fully_paid: isFullyPaid, total_paid: totalPaidAmount },
            message: rpcResult.cached
                ? 'Pago ya procesado anteriormente'
                : isFullyPaid ? 'Pago completado - Factura pagada' : 'Pago registrado',
            cached: Boolean(rpcResult.cached),
            idempotency_key: idempotencyKey
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/payments", method: "POST", error, requestBody })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
