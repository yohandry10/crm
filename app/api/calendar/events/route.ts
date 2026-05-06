import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { requireRolePermission } from "@/lib/role-permissions"
import { rateLimit } from "@/lib/rate-limit"
import { assertCalendarDateRange, hydrateCalendarEventOwners, serializeCalendarEvent, validateCalendarEventReferences } from "@/lib/calendar-events"
import crypto from "crypto"
import { z } from "zod"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 100 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

const eventSchema = z.object({
  title: z.string().min(1, "Título requerido"),
  description: z.string().optional().nullable(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  location: z.string().optional().nullable(),
  contact_id: z.preprocess(
    (value) => (!value || value === "none" ? null : value),
    z.string().uuid().optional().nullable()
  ),
  opportunity_id: z.preprocess(
    (value) => (!value || value === "none" ? null : value),
    z.string().uuid().optional().nullable()
  ),
  attendees: z.array(z.object({
    email: z.string().email(),
    name: z.string().optional()
  })).optional(),
  reminder_minutes: z.coerce.number().int().min(0).max(10080).optional(),
  event_type: z.enum(["meeting", "call", "task", "other"]).default("meeting"),
})

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()

    const searchParams = request.nextUrl.searchParams
    const startDate = searchParams.get("start")
    const endDate = searchParams.get("end")
    const contactId = searchParams.get("contact_id")
    const ownerId = searchParams.get("owner_id")

    let query = supabase
      .from("calendar_events")
      .select(`
        *,
        contact:contacts(id, name, email),
        opportunity:opportunities(id, name)
      `)
      .eq("organization_id", organizationId)
      .order("start_time", { ascending: true })

    if (startDate) {
      query = query.gte("start_time", startDate)
    }
    if (endDate) {
      query = query.lte("end_time", endDate)
    }
    if (contactId) {
      query = query.eq("contact_id", contactId)
    }
    if (ownerId) {
      query = query.eq("owner_id", ownerId)
    }

    const { data, error } = await query

    if (error) throw error

    const events = await hydrateCalendarEventOwners(supabase, data || [])

    return NextResponse.json({
      success: true,
      data: events.map(event => ({
        ...serializeCalendarEvent(event),
        contact: event.contact,
        opportunity: event.opportunity,
        owner: event.owner,
      }))
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/calendar/events",
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

    const { supabase, user, organizationId, role } = await getAuthenticatedContext()
    await requireRolePermission(supabase, role, "tasks", "can_create")
    const body = await request.json()

    const validation = eventSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    const eventData = validation.data
    assertCalendarDateRange(eventData.start, eventData.end)
    await validateCalendarEventReferences(supabase, organizationId, eventData)

    const { data, error } = await supabase
      .from("calendar_events")
      .insert({
        organization_id: organizationId,
        owner_id: user.id,
        title: eventData.title,
        description: eventData.description,
        start_time: eventData.start,
        end_time: eventData.end,
        location: eventData.location,
        contact_id: eventData.contact_id,
        opportunity_id: eventData.opportunity_id,
        attendees: eventData.attendees,
        reminder_minutes: eventData.reminder_minutes || 15,
        event_type: eventData.event_type,
      })
      .select()
      .single()

    if (error) throw error

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "CREATE_EVENT",
      table: "calendar_events",
      recordId: data.id,
      newData: eventData,
    })

    return NextResponse.json({ success: true, data: serializeCalendarEvent(data) })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/calendar/events",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
