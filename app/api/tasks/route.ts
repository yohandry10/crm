import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { taskSchema } from "@/lib/schemas"
import { validatePagination } from "@/lib/auth-helpers"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { validateTaskReferences } from "@/lib/work-item-references"
import { z } from "zod"
import crypto from "crypto"

const taskFilterSchema = z.object({
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
    contact_id: z.string().uuid().optional(),
})

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const filters = taskFilterSchema.safeParse({
            status: searchParams.get("status") || undefined,
            priority: searchParams.get("priority") || undefined,
            contact_id: searchParams.get("contact_id") || undefined,
        })

        if (!filters.success) {
            throw new ValidationError("Filtros inválidos", filters.error.format())
        }

        const { page, limit, offset } = validatePagination(searchParams)

        let query = supabase
            .from("tasks")
            .select("*, contact:contacts(name, email)", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("due_date", { ascending: true, nullsFirst: false })

        if (filters.data.status) query = query.eq("status", filters.data.status)
        if (filters.data.priority) query = query.eq("priority", filters.data.priority)
        if (filters.data.contact_id) query = query.eq("contact_id", filters.data.contact_id)

        const { data, error, count } = await query.range(offset, offset + limit - 1)
        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
                hasNext: page < Math.ceil((count || 0) / limit),
                hasPrev: page > 1
            }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/tasks", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = taskSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        await validateTaskReferences(supabase, organizationId, validation.data)

        const { data, error } = await supabase
            .from("tasks")
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "CREATE_TASK", table: "tasks", recordId: data.id, newData: validation.data })

        // Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'task.created',
            source: 'api/tasks',
            payload: { ...data, user_id: user.id, organization_id: organizationId }
        }, supabase)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/tasks", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
