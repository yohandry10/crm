import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { salesOrderSchema } from "@/lib/schemas"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { getPaginationParams } from "@/lib/pagination"
import { validateSalesOrderReferences } from "@/lib/sales-order-references"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get("status")
        const account_id = searchParams.get("account_id")
        const opportunity_id = searchParams.get("opportunity_id")
        const search = searchParams.get("search")?.trim()
        const { page, limit, offset } = getPaginationParams(searchParams)

        let query = supabase
            .from("sales_orders")
            .select("*, account:accounts(id, name), contact:contacts(id, name, email), opportunity:opportunities(id, name)", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (status) query = query.eq("status", status)
        if (account_id) query = query.eq("account_id", account_id)
        if (opportunity_id) query = query.eq("opportunity_id", opportunity_id)
        if (search) query = query.ilike("order_number", `%${search}%`)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/orders", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = salesOrderSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.format() }, { status: 400 })
        }

        await validateSalesOrderReferences(supabase, organizationId, validation.data)

        const { data, error } = await supabase
            .from("sales_orders")
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        // Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'order.created',
            source: 'api/orders',
            payload: { ...data, user_id: user.id, organization_id: organizationId }
        }, supabase)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/orders", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
