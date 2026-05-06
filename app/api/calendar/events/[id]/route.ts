import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { assertCalendarDateRange, hydrateCalendarEventOwners, serializeCalendarEvent, validateCalendarEventReferences } from "@/lib/calendar-events"
import crypto from "crypto"
import { z } from "zod"

const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  start: z.string().datetime().optional(),
  end: z.string().datetime().optional(),
  location: z.string().optional().nullable(),
  contact_id: z.preprocess(
    (value) => (!value || value === "none" ? null : value),
    z.string().uuid().nullable().optional()
  ),
  opportunity_id: z.preprocess(
    (value) => (!value || value === "none" ? null : value),
    z.string().uuid().nullable().optional()
  ),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional()
  })).optional(),
  reminder_minutes: z.coerce.number().int().min(0).max(10080).optional(),
  event_type: z.enum(["meeting", "call", "task", "other"]).optional(),
  status: z.enum(["scheduled", "completed", "cancelled"]).optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()

    const { data, error } = await supabase
      .from("calendar_events")
      .select(`
        *,
        contact:contacts(id, name, email, phone),
        opportunity:opportunities(id, name, value)
      `)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Evento no encontrado" },
        { status: 404 }
      )
    }

    const [event] = await hydrateCalendarEventOwners(supabase, [data])

    return NextResponse.json({ success: true, data: serializeCalendarEvent(event) })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const body = await request.json()

    const validation = updateEventSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    // Get existing event
    const { data: existing, error: existingError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Evento no encontrado" },
        { status: 404 }
      )
    }

    const nextStart = validation.data.start ?? existing.start_time
    const nextEnd = validation.data.end ?? existing.end_time
    assertCalendarDateRange(nextStart, nextEnd)
    await validateCalendarEventReferences(supabase, organizationId, validation.data)

    const updateData: any = {}
    if (validation.data.title) updateData.title = validation.data.title
    if (validation.data.description !== undefined) updateData.description = validation.data.description
    if (validation.data.start) updateData.start_time = validation.data.start
    if (validation.data.end) updateData.end_time = validation.data.end
    if (validation.data.location !== undefined) updateData.location = validation.data.location
    if (validation.data.contact_id !== undefined) updateData.contact_id = validation.data.contact_id
    if (validation.data.opportunity_id !== undefined) updateData.opportunity_id = validation.data.opportunity_id
    if (validation.data.attendees) updateData.attendees = validation.data.attendees
    if (validation.data.reminder_minutes) updateData.reminder_minutes = validation.data.reminder_minutes
    if (validation.data.event_type) updateData.event_type = validation.data.event_type
    if (validation.data.status) updateData.status = validation.data.status

    const { data, error } = await supabase
      .from("calendar_events")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "UPDATE_EVENT",
      table: "calendar_events",
      recordId: id,
      oldData: existing,
      newData: data,
    })

    return NextResponse.json({ success: true, data: serializeCalendarEvent(data) })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: `/api/calendar/events/${(await params).id}`,
      method: "PUT",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const { supabase, user, organizationId } = await getAuthenticatedContext()

    const { data: existing, error: existingError } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle()

    if (existingError) throw existingError
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Evento no encontrado" },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (error) throw error

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "DELETE_EVENT",
      table: "calendar_events",
      recordId: id,
      oldData: existing,
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: `/api/calendar/events/${(await params).id}`,
      method: "DELETE",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
