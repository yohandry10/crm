import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError, NotFoundError, ValidationError } from '@/lib/error-handler'
import { taskSchema } from '@/lib/schemas'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { validateTaskReferences } from '@/lib/work-item-references'
import { requireCanManageRecord, requireRolePermission } from '@/lib/role-permissions'
import crypto from 'crypto'

const updateTaskSchema = taskSchema.partial()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from('tasks')
            .select(`
                *,
                contact:contacts(id, name, email)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (error) throw error
        if (!data) throw new NotFoundError('Tarea', id)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tasks/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let requestBody: any = undefined
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "tasks", "can_update")
        const { id } = await params
        requestBody = await request.json()

        // ✅ Validación con Zod (partial para updates)
        const validation = updateTaskSchema.safeParse(requestBody)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        if (Object.keys(validation.data).length === 0) {
            throw new ValidationError("Se requiere al menos un campo para actualizar")
        }

        await validateTaskReferences(supabase, organizationId, validation.data)

        const { data: existingTask } = await supabase
            .from('tasks')
            .select('created_by')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (!existingTask) throw new NotFoundError('Tarea', id)
        await requireCanManageRecord(supabase, { role, resource: "tasks", recordOwnerId: existingTask.created_by, userId: user.id })

        const { data, error } = await supabase
            .from('tasks')
            .update(validation.data)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .maybeSingle()

        if (error) throw error
        if (!data) throw new NotFoundError('Tarea', id)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tasks/[id]`,
            method: "PATCH",
            error,
            requestBody,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "tasks", "can_delete")
        const { id } = await params

        const { data: existingTask } = await supabase
            .from('tasks')
            .select('created_by')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (!existingTask) throw new NotFoundError('Tarea', id)
        await requireCanManageRecord(supabase, { role, resource: "tasks", recordOwnerId: existingTask.created_by, userId: user.id })

        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/tasks/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
