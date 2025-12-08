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
