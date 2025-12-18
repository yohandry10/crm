import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { workflowSchema } from "@/lib/schemas"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId } = await getAuthenticatedContext()

        const page = parseInt(request.nextUrl.searchParams.get("page") || "1")
        const limit = parseInt(request.nextUrl.searchParams.get("limit") || "10")
        const offset = (page - 1) * limit
        const triggerType = request.nextUrl.searchParams.get("trigger_type")
        const isActive = request.nextUrl.searchParams.get("is_active")

        let query = supabase
            .from("workflows")
            .select("*", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })

        if (triggerType) query = query.eq("trigger_type", triggerType)
        if (isActive !== null && isActive !== undefined) query = query.eq("is_active", isActive === "true")

        const { data, error, count } = await query.range(offset, offset + limit - 1)
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/workflows", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = workflowSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.format() }, { status: 400 })
        }

        const { data, error } = await supabase
            .from("workflows")
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "CREATE_WORKFLOW", table: "workflows", recordId: data.id, newData: body })

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/workflows", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
