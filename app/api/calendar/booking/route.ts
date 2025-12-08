import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import crypto from "crypto"
import { z } from "zod"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 100 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }

const bookingConfigSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  duration: z.number().min(5).max(480),
  buffer: z.number().min(0).max(60).default(10),
  available_days: z.array(z.number().min(0).max(6)),
  available_hours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/)
  }),
  max_advance_days: z.number().min(1).max(365).default(30),
  questions: z.array(z.object({
    question: z.string(),
    required: z.boolean().default(false)
  })).optional(),
  is_active: z.boolean().default(true),
})

const bookingRequestSchema = z.object({
  config_id: z.string().uuid(),
  slot_start: z.string().datetime(),
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  notes: z.string().optional(),
  answers: z.record(z.string()).optional(),
})

// GET: List booking configs or get available slots
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const searchParams = request.nextUrl.searchParams
    const configId = searchParams.get("config_id")
    const date = searchParams.get("date")

    // Public endpoint for getting slots
    if (configId && date) {
      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Get booking config
      const { data: config, error: configError } = await supabaseAdmin
        .from("booking_configs")
        .select("*")
        .eq("id", configId)
        .eq("is_active", true)
        .single()

      if (configError || !config) {
        return NextResponse.json(
          { success: false, error: "Configuración no encontrada" },
          { status: 404 }
        )
      }

      // Get existing events for that day
      const targetDate = new Date(date)
      const dayStart = new Date(targetDate)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(targetDate)
      dayEnd.setHours(23, 59, 59, 999)

      const { data: events } = await supabaseAdmin
        .from("calendar_events")
        .select("start_time, end_time")
        .eq("organization_id", config.organization_id)
        .eq("owner_id", config.owner_id)
        .gte("start_time", dayStart.toISOString())
        .lte("end_time", dayEnd.toISOString())
        .neq("status", "cancelled")

      // Generate available slots
      const slots = generateSlots(config, targetDate, events || [])

      return NextResponse.json({
        success: true,
        data: {
          config: {
            name: config.name,
            duration: config.duration,
          },
          slots
        }
      })
    }

    // Authenticated endpoint for managing configs
    const { supabase, organizationId } = await getAuthenticatedContext()

    const { data, error } = await supabase
      .from("booking_configs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/calendar/booking",
      method: "GET",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// POST: Create booking config or book a slot
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const body = await request.json()

    // Public booking request
    if (body.config_id && body.slot_start) {
      const validation = bookingRequestSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors
        }, { status: 400 })
      }

      const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )

      // Get config
      const { data: config } = await supabaseAdmin
        .from("booking_configs")
        .select("*")
        .eq("id", validation.data.config_id)
        .eq("is_active", true)
        .single()

      if (!config) {
        return NextResponse.json(
          { success: false, error: "Configuración no encontrada" },
          { status: 404 }
        )
      }

      const slotStart = new Date(validation.data.slot_start)
      const slotEnd = new Date(slotStart.getTime() + config.duration * 60000)

      // Check if slot is still available
      const { data: conflicts } = await supabaseAdmin
        .from("calendar_events")
        .select("id")
        .eq("organization_id", config.organization_id)
        .eq("owner_id", config.owner_id)
        .lt("start_time", slotEnd.toISOString())
        .gt("end_time", slotStart.toISOString())
        .neq("status", "cancelled")

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json(
          { success: false, error: "Este horario ya no está disponible" },
          { status: 409 }
        )
      }

      // Create or find contact
      let contactId: string | null = null
      const { data: existingContact } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("organization_id", config.organization_id)
        .eq("email", validation.data.email)
        .single()

      if (existingContact) {
        contactId = existingContact.id
      } else {
        const { data: newContact } = await supabaseAdmin
          .from("contacts")
          .insert({
            organization_id: config.organization_id,
            name: validation.data.name,
            email: validation.data.email,
            phone: validation.data.phone,
            lead_source: "booking",
            lead_status: "warm",
          })
          .select()
          .single()
        contactId = newContact?.id
      }

      // Create calendar event
      const { data: event, error: eventError } = await supabaseAdmin
        .from("calendar_events")
        .insert({
          organization_id: config.organization_id,
          owner_id: config.owner_id,
          contact_id: contactId,
          title: `${config.name} - ${validation.data.name}`,
          description: validation.data.notes,
          start_time: slotStart.toISOString(),
          end_time: slotEnd.toISOString(),
          event_type: "meeting",
          attendees: [{ email: validation.data.email, name: validation.data.name }],
          booking_data: {
            config_id: config.id,
            answers: validation.data.answers,
          },
        })
        .select()
        .single()

      if (eventError) throw eventError

      // TODO: Send confirmation email

      return NextResponse.json({
        success: true,
        data: {
          event_id: event.id,
          start: slotStart,
          end: slotEnd,
        }
      })
    }

    // Authenticated: Create booking config
    const { supabase, user, organizationId } = await getAuthenticatedContext()

    const validation = bookingConfigSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("booking_configs")
      .insert({
        organization_id: organizationId,
        owner_id: user.id,
        ...validation.data,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/calendar/booking",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

function generateSlots(
  config: any,
  date: Date,
  existingEvents: { start_time: string; end_time: string }[]
) {
  const slots: { start: string; end: string; available: boolean }[] = []
  
  // Check if day is available
  if (!config.available_days.includes(date.getDay())) {
    return slots
  }

  const [startHour, startMin] = config.available_hours.start.split(":").map(Number)
  const [endHour, endMin] = config.available_hours.end.split(":").map(Number)

  let currentTime = new Date(date)
  currentTime.setHours(startHour, startMin, 0, 0)

  const endTime = new Date(date)
  endTime.setHours(endHour, endMin, 0, 0)

  const now = new Date()

  while (currentTime < endTime) {
    const slotEnd = new Date(currentTime.getTime() + config.duration * 60000)
    
    if (slotEnd > endTime) break

    // Check availability
    const isInPast = currentTime <= now
    const hasConflict = existingEvents.some(event => {
      const eventStart = new Date(event.start_time)
      const eventEnd = new Date(event.end_time)
      return currentTime < eventEnd && slotEnd > eventStart
    })

    slots.push({
      start: currentTime.toISOString(),
      end: slotEnd.toISOString(),
      available: !isInPast && !hasConflict,
    })

    // Next slot
    currentTime = new Date(currentTime.getTime() + (config.duration + config.buffer) * 60000)
  }

  return slots
}
