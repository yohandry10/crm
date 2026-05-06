import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from '@/lib/error-handler'
import { assertCalendarDateRange, hydrateCalendarEventOwners, serializeCalendarEvent, validateCalendarEventReferences } from '@/lib/calendar-events'
import { z } from 'zod'
import crypto from 'crypto'

const updateEventSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    start: z.string().datetime().optional(),
    end: z.string().datetime().optional(),
    start_time: z.string().datetime().optional(),
    end_time: z.string().datetime().optional(),
    all_day: z.boolean().optional(),
    contact_id: z.preprocess(
        (value) => (!value || value === "none" ? null : value),
        z.string().uuid().optional().nullable()
    ),
    opportunity_id: z.preprocess(
        (value) => (!value || value === "none" ? null : value),
        z.string().uuid().optional().nullable()
    ),
    location: z.string().optional(),
    reminder_minutes: z.coerce.number().int().min(0).max(10080).optional(),
    event_type: z.enum(["meeting", "call", "task", "other"]).optional(),
    status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from('calendar_events')
            .select(`
                *,
                contact:contacts(id, name, email),
                opportunity:opportunities(id, name)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (error) throw error
        if (!data) {
            throw new ValidationError("Evento no encontrado")
        }

        const [event] = await hydrateCalendarEventOwners(supabase, [data])

        return NextResponse.json({ success: true, data: serializeCalendarEvent(event) })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/events/[id]`,
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
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = updateEventSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Datos inválidos",
                details: validation.error.errors
            }, { status: 400 })
        }

        const { data: existing, error: existingError } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .maybeSingle()

        if (existingError) throw existingError
        if (!existing) {
            throw new ValidationError("Evento no encontrado")
        }

        const updateData: any = {}
        if (validation.data.title) updateData.title = validation.data.title
        if (validation.data.description !== undefined) updateData.description = validation.data.description
        if (validation.data.start || validation.data.start_time) updateData.start_time = validation.data.start ?? validation.data.start_time
        if (validation.data.end || validation.data.end_time) updateData.end_time = validation.data.end ?? validation.data.end_time
        if (validation.data.contact_id !== undefined) updateData.contact_id = validation.data.contact_id
        if (validation.data.opportunity_id !== undefined) updateData.opportunity_id = validation.data.opportunity_id
        if (validation.data.location !== undefined) updateData.location = validation.data.location
        if (validation.data.reminder_minutes !== undefined) updateData.reminder_minutes = validation.data.reminder_minutes
        if (validation.data.event_type) updateData.event_type = validation.data.event_type
        if (validation.data.status) updateData.status = validation.data.status

        if (Object.keys(updateData).length === 0) {
            throw new ValidationError("No hay cambios para actualizar")
        }

        const nextStart = updateData.start_time ?? existing.start_time
        const nextEnd = updateData.end_time ?? existing.end_time
        assertCalendarDateRange(nextStart, nextEnd)
        await validateCalendarEventReferences(supabase, organizationId, validation.data)

        const { data, error } = await supabase
            .from('calendar_events')
            .update(updateData)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data: serializeCalendarEvent(data) })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/events/[id]`,
            method: "PATCH",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { error } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/events/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
