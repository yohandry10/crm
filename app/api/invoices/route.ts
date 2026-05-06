import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { invoiceSchema } from "@/lib/schemas"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { requireRolePermission } from "@/lib/role-permissions"
import crypto from "crypto"
import { getPaginationParams } from "@/lib/pagination"

const READ_LIMIT = RATE_LIMITS.read
const WRITE_LIMIT = RATE_LIMITS.sensitive

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, READ_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get("status")
        const contact_id = searchParams.get("contact_id")
        const { page, limit, offset } = getPaginationParams(searchParams)

        let query = supabase
            .from("invoices")
            .select("*, contact:contacts(name, email)", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("issue_date", { ascending: false })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (status) query = query.eq("status", status)
        if (contact_id) query = query.eq("contact_id", contact_id)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/invoices", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    let requestBody: unknown = undefined
    try {
        const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "invoices", "can_create")
        requestBody = await request.json()
        const body = requestBody

        const validation = invoiceSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.format() }, { status: 400 })
        }

        const { contact_id, items, due_date, notes } = validation.data

        // MULTI-TENANT: Use atomic function with org_id
        const { data: rpcData, error } = await supabase
            .rpc('create_invoice_with_items_atomic', {
                p_org_id: organizationId,
                p_user_id: user.id,
                p_contact_id: contact_id,
                p_items: items,
                p_due_date: due_date || null,
                p_notes: notes || null
            })
            .single()

        const data = rpcData as any
        if (error) {
            return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
        }

        await logAudit({
            supabase, request, userId: user.id, organizationId,
            action: "CREATE_INVOICE", table: "invoices", recordId: data.invoice_id,
            newData: { contact_id, items_count: data.items_created, total: data.total_amount },
        })

        return NextResponse.json({
            success: true,
            data: { id: data.invoice_id, invoice_number: data.invoice_number, total: data.total_amount, items_count: data.items_created },
            message: `Factura ${data.invoice_number} creada exitosamente`
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/invoices", method: "POST", error, requestBody })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
