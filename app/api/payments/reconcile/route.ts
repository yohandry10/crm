import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from 'zod'
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"

const reconcileSchema = z.object({
    payment_id: z.string().uuid("ID de pago inválido"),
    invoice_id: z.string().uuid("ID de factura inválido"),
    notes: z.string().optional()
})

const SENSITIVE_LIMIT = RATE_LIMITS.sensitive

// GET /api/payments/reconcile - Get unreconciled payments with suggestions
export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, SENSITIVE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .rpc('get_unreconciled_payments', { p_organization_id: organizationId })

        if (error) throw error

        return NextResponse.json({
            success: true,
            data: data || [],
            count: data?.length || 0
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/payments/reconcile",
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

// POST /api/payments/reconcile - Manually reconcile payment to invoice
export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, SENSITIVE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = reconcileSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Datos inválidos",
                details: validation.error.errors
            }, { status: 400 })
        }

        const { payment_id, invoice_id, notes } = validation.data

        const { data, error } = await supabase
            .rpc('manual_reconcile_payment', {
                p_payment_id: payment_id,
                p_invoice_id: invoice_id,
                p_organization_id: organizationId,
                p_notes: notes || null
            })

        if (error) throw error

        if (!data?.success) {
            return NextResponse.json({
                success: false,
                error: data?.error || "Reconciliation failed"
            }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            data,
            message: `Pago reconciliado ${data.status === 'matched' ? 'completamente' : 'parcialmente'} con factura`
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/payments/reconcile",
            method: "POST",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
