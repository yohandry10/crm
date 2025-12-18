import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { contactSchema } from "@/lib/schemas"
import { rateLimit } from "@/lib/rate-limit"
import { requirePlanLimit } from "@/lib/plan-limits"
import { validatePagination } from "@/lib/auth-helpers"
import { createRequestLogger } from "@/lib/logger"
import crypto from "crypto"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 100 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, READ_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const search = searchParams.get("search")
        const status = searchParams.get("status")
        const tag = searchParams.get("tag")
        const { page, limit, offset } = validatePagination(searchParams)

        // Search with organization filter
        if (search && search.trim().length > 0) {
            const rpcLimit = Math.min(100, offset + limit)
            const { data, error } = await supabase
                .rpc('search_contacts', {
                    p_org_id: organizationId,
                    p_query: search.trim(),
                    p_limit: rpcLimit
                })

            if (error) throw error

            const pagedData = (data || []).slice(offset, offset + limit)
            return NextResponse.json({
                success: true,
                data: pagedData,
                pagination: {
                    page,
                    limit,
                    total: pagedData.length,
                    hasPrev: page > 1,
                    hasNext: (data || []).length > offset + limit
                }
            })
        }

        // Query with organization filter (RLS also enforces this)
        let query = supabase
            .from("contacts")
            .select("*", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (status) query = query.eq("lead_status", status)
        if (tag) query = query.contains("tags", [tag])

        const { data, error, count } = await query

        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/contacts",
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const log = createRequestLogger(request, organizationId)
        const body = await request.json()

        // VERIFICACIÓN DE LÍMITES DEL PLAN
        const planCheck = await requirePlanLimit(organizationId, "contacts")
        if (!planCheck.allowed) {
            return NextResponse.json({
                success: false,
                error: planCheck.error,
                limit: planCheck.limit
            }, { status: 403 })
        }

        const validation = contactSchema.safeParse(body)

        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Validation failed",
                details: validation.error.errors
            }, { status: 400 })
        }

        const insertData = {
            ...validation.data,
            organization_id: organizationId,
            created_by: user.id,
        }

        const { data, error } = await supabase
            .from("contacts")
            .insert(insertData)
            .select()
            .single()

        if (error) throw error

        // Audit logging (non-blocking)
        try {
            await logAudit({
                supabase,
                request,
                userId: user.id,
                organizationId,
                action: "CREATE_CONTACT",
                table: "contacts",
                recordId: data.id,
                newData: validation.data,
            })
        } catch (auditError) {
            log.warn("Audit logging failed (non-blocking)", { error: auditError })
        }

        // Event emission (non-blocking)
        try {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'contact.created',
                source: 'internal',
                payload: {
                    id: data.id,
                    organization_id: organizationId,
                    user_id: user.id,
                    name: data.name,
                    email: data.email,
                    lead_status: data.lead_status
                }
            }, supabase as any)
        } catch (eventError) {
            log.warn("Event emission failed (non-blocking)", { error: eventError })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/contacts",
            method: "POST",
            error,
        })

        const status = getHttpStatusForError(error)

        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status }
        )
    }
}
