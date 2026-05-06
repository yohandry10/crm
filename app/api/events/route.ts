import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from '@/lib/error-handler'
import { assertCalendarDateRange, hydrateCalendarEventOwners, serializeCalendarEvent, validateCalendarEventReferences } from '@/lib/calendar-events'
import { requireRolePermission } from '@/lib/role-permissions'
import { z } from 'zod'
import crypto from 'crypto'

const eventSchema = z.object({
    title: z.string().min(1, "Título requerido").max(200),
    start: z.string().datetime("Fecha de inicio inválida").optional(),
    end: z.string().datetime("Fecha de fin inválida").optional(),
    start_time: z.string().datetime("Fecha de inicio inválida").optional(),
    end_time: z.string().datetime("Fecha de fin inválida").optional(),
    contact_id: z.preprocess(
        (value) => (!value || value === "none" ? null : value),
        z.string().uuid().optional().nullable()
    ),
    opportunity_id: z.preprocess(
        (value) => (!value || value === "none" ? null : value),
        z.string().uuid().optional().nullable()
    ),
    description: z.string().max(1000).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    all_day: z.boolean().default(false),
    reminder_minutes: z.coerce.number().int().min(0).max(10080).optional(),
    event_type: z.enum(["meeting", "call", "task", "other"]).default("meeting"),
})

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')
        const contact_id = searchParams.get('contact_id')

        let query = supabase
            .from('calendar_events')
            .select(`*, contact:contacts(id, name), opportunity:opportunities(id, name)`)
            .eq('organization_id', organizationId)
            .order('start_time', { ascending: true })

        if (start) query = query.gte('start_time', start)
        if (end) query = query.lte('end_time', end)
        if (contact_id) query = query.eq('contact_id', contact_id)

        const { data, error } = await query
        if (error) throw error

        const events = await hydrateCalendarEventOwners(supabase, data || [])

        return NextResponse.json({ success: true, data: events.map(serializeCalendarEvent) })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/events", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    let requestBody: unknown = undefined
    try {
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "tasks", "can_create")
        requestBody = await request.json()
        const body = requestBody

        const validation = eventSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { title, contact_id, opportunity_id, description, location, reminder_minutes, event_type } = validation.data
        const start = validation.data.start ?? validation.data.start_time
        const end = validation.data.end ?? validation.data.end_time

        if (!start || !end) {
            throw new ValidationError("Fecha de inicio y fin requeridas")
        }

        assertCalendarDateRange(start, end)
        await validateCalendarEventReferences(supabase, organizationId, validation.data)

        const { data, error } = await supabase
            .from('calendar_events')
            .insert({
                organization_id: organizationId,
                owner_id: user.id,
                title,
                start_time: start,
                end_time: end,
                contact_id,
                opportunity_id,
                description,
                location,
                reminder_minutes: reminder_minutes || 15,
                event_type,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data: serializeCalendarEvent(data) })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/events", method: "POST", error, requestBody })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
