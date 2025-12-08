import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { taskSchema } from "@/lib/schemas"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get("status")
        const priority = searchParams.get("priority")
        const contact_id = searchParams.get("contact_id")

        let query = supabase
            .from("tasks")
            .select("*, contact:contacts(name, email)")
            .eq("organization_id", organizationId)
            .order("due_date", { ascending: true, nullsFirst: false })

        if (status) query = query.eq("status", status)
        if (priority) query = query.eq("priority", priority)
        if (contact_id) query = query.eq("contact_id", contact_id)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/tasks", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = taskSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

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
