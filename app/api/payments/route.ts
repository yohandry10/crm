import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

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
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const { invoice_id, amount, payment_method, transaction_id, gateway } = body

        if (!invoice_id || !amount || !payment_method || !gateway) {
            throw new ValidationError("Campos requeridos faltantes", { required: ['invoice_id', 'amount', 'payment_method', 'gateway'] })
        }
        if (typeof amount !== 'number' || amount <= 0) {
            throw new ValidationError("El monto debe ser un número positivo")
        }

        const allowedGateways = ['stripe', 'bank_transfer', 'cash', 'yape', 'plin', 'mercadopago']
        if (!allowedGateways.includes(gateway.toLowerCase())) {
            throw new ValidationError(`Gateway inválido. Permitidos: ${allowedGateways.join(', ')}`)
        }

        // MULTI-TENANT: Insert with organization_id
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
                paid_at: new Date().toISOString()
            })
            .select()
            .single()

        if (paymentError) throw paymentError

        // Update invoice status if fully paid
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

        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'payment.completed', source: 'internal',
            payload: { payment_id: payment.id, organization_id: organizationId, user_id: user.id, invoice_id, amount, gateway }
        }, supabase as any)

        return NextResponse.json({
            success: true,
            data: { payment_id: payment.id, is_fully_paid: isFullyPaid, total_paid: totalPaidAmount },
            message: isFullyPaid ? 'Pago completado - Factura pagada' : 'Pago registrado'
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/payments", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
