import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

type RouteContext = {
    params: Promise<{ id: string }>
}

export async function GET(
    request: NextRequest,
    context: RouteContext
) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params

        // Get payment with invoice and contact details
        const { data: payment, error } = await supabase
            .from("payments")
            .select(`
                *,
                invoice:invoices(id, invoice_number, total, status),
                contact:contacts(id, name, email, company)
            `)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (error) {
            if (error.code === "PGRST116") {
                return NextResponse.json(
                    { success: false, error: "Payment not found" },
                    { status: 404 }
                )
            }
            throw error
        }

        return NextResponse.json({ success: true, data: payment })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/payments/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params
        const body = await request.json()

        const { status, verified_at } = body

        // Validate status
        const validStatuses = ['pending', 'completed', 'failed', 'refunded']
        if (status && !validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, error: "Estado inválido" },
                { status: 400 }
            )
        }

        // Get current payment to find invoice
        const { data: currentPayment, error: fetchError } = await supabase
            .from("payments")
            .select("*, invoice:invoices(id, status, total)")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (fetchError) {
            if (fetchError.code === "PGRST116") {
                return NextResponse.json(
                    { success: false, error: "Pago no encontrado" },
                    { status: 404 }
                )
            }
            throw fetchError
        }

        if (status === 'completed' && currentPayment.status !== 'completed' && currentPayment.invoice?.id) {
            const { data: completedPayments } = await supabase
                .from("payments")
                .select("amount")
                .eq("invoice_id", currentPayment.invoice.id)
                .eq("organization_id", organizationId)
                .eq("status", "completed")

            const totalPaid = (completedPayments || []).reduce((sum, p) => sum + Number(p.amount), 0)
            const remainingBalance = Number(currentPayment.invoice.total) - totalPaid

            if (Number(currentPayment.amount) > remainingBalance) {
                return NextResponse.json(
                    {
                        success: false,
                        error: `El monto del pago (${currentPayment.amount}) excede el saldo pendiente de la factura (${remainingBalance})`,
                    },
                    { status: 400 }
                )
            }
        }

        // Update payment
        const updateData: any = {}
        if (status) {
            updateData.status = status
            if (status === 'completed') {
                updateData.paid_at = new Date().toISOString()
            }
        }
        if (verified_at) updateData.verified_at = verified_at

        const { data: payment, error } = await supabase
            .from("payments")
            .update(updateData)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        // If payment is completed and invoice exists, update invoice status to 'paid'
        if (status === 'completed' && currentPayment.invoice?.id) {
            // Check total paid for this invoice
            const { data: allPayments } = await supabase
                .from("payments")
                .select("amount")
                .eq("invoice_id", currentPayment.invoice.id)
                .eq("organization_id", organizationId)
                .eq("status", "completed")

            const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0)

            // If total paid >= invoice total, mark invoice as paid
            if (totalPaid >= currentPayment.invoice.total) {
                await supabase
                    .from("invoices")
                    .update({ status: 'paid', paid_at: new Date().toISOString() })
                    .eq("id", currentPayment.invoice.id)
                    .eq("organization_id", organizationId)
                await supabase
                    .from("quotes")
                    .update({ status: 'paid', updated_at: new Date().toISOString() })
                    .eq("invoice_id", currentPayment.invoice.id)
                    .eq("organization_id", organizationId)
            }
        }

        return NextResponse.json({ success: true, data: payment })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/payments/[id]`,
            method: "PATCH",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
