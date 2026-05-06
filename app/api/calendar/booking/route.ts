import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { sendEmail, isEmailConfigured } from "@/lib/email"
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

type PublicBookingResult = {
  event_id: string
  contact_id: string | null
  organization_id: string
  owner_id: string
  booking_name: string
  start_time: string
  end_time: string
}

function getAdminClient() {
  return createSupabaseServiceClient()
}

function getAllowedOrigin(request: NextRequest): string | null {
  const allowed = (process.env.PUBLIC_BOOKING_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  const origin = request.headers.get('origin')
  const hostOrigin = request.nextUrl.origin
  if (allowed.length === 0) return process.env.NODE_ENV === 'production' ? null : origin || hostOrigin
  if (origin && allowed.includes(origin)) return origin
  if (!origin && allowed.includes(hostOrigin)) return hostOrigin
  return null
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number)
  return hours * 60 + minutes
}

function minutesSinceStartOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

function validateRequestedSlot(config: any, slotStart: Date, slotEnd: Date): string | null {
  if (Number.isNaN(slotStart.getTime()) || Number.isNaN(slotEnd.getTime())) {
    return "Horario inválido"
  }

  const now = new Date()
  if (slotStart <= now) {
    return "No se puede reservar un horario pasado"
  }

  const maxAdvance = Number(config.max_advance_days || 30)
  const maxAllowedDate = new Date(now.getTime() + maxAdvance * 24 * 60 * 60 * 1000)
  if (slotStart > maxAllowedDate) {
    return "El horario excede la anticipación máxima permitida"
  }

  if (!Array.isArray(config.available_days) || !config.available_days.includes(slotStart.getDay())) {
    return "El día seleccionado no está disponible"
  }

  const slotMinutes = minutesSinceStartOfDay(slotStart)
  const slotEndMinutes = minutesSinceStartOfDay(slotEnd)
  const allowedStart = timeToMinutes(config.available_hours?.start || "00:00")
  const allowedEnd = timeToMinutes(config.available_hours?.end || "00:00")

  if (slotStart.toDateString() !== slotEnd.toDateString()) {
    return "El horario seleccionado no puede cruzar de día"
  }

  if (slotMinutes < allowedStart || slotEndMinutes > allowedEnd) {
    return "El horario seleccionado está fuera de la ventana disponible"
  }

  return null
}

function escapeHtml(value: unknown): string {
  const str = String(value ?? "")
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

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
      const allowedOrigin = getAllowedOrigin(request)
      if (!allowedOrigin) {
        return NextResponse.json({ success: false, error: "Origin not allowed" }, { status: 403 })
      }

      const supabaseAdmin = getAdminClient()

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

      const response = NextResponse.json({
        success: true,
        data: {
          config: {
            name: config.name,
            duration: config.duration,
          },
          slots
        }
      })
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
      return response
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
      const allowedOrigin = getAllowedOrigin(request)
      if (!allowedOrigin) {
        return NextResponse.json({ success: false, error: "Origin not allowed" }, { status: 403 })
      }

      const validation = bookingRequestSchema.safeParse(body)
      if (!validation.success) {
        return NextResponse.json({
          success: false,
          error: "Validation failed",
          details: validation.error.errors
        }, { status: 400 })
      }

      const supabaseAdmin = getAdminClient()

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
      const slotError = validateRequestedSlot(config, slotStart, slotEnd)
      if (slotError) {
        return NextResponse.json(
          { success: false, error: slotError },
          { status: 400 }
        )
      }

      const { data: booking, error: bookingError } = await supabaseAdmin
        .rpc("book_public_calendar_slot", {
          p_config_id: validation.data.config_id,
          p_slot_start: slotStart.toISOString(),
          p_name: validation.data.name,
          p_email: validation.data.email,
          p_phone: validation.data.phone || null,
          p_notes: validation.data.notes || null,
          p_answers: validation.data.answers || {},
        })
        .single()

      if (bookingError?.message?.includes("Este horario ya no está disponible")) {
        return NextResponse.json(
          { success: false, error: "Este horario ya no está disponible" },
          { status: 409 }
        )
      }

      if (bookingError) {
        return NextResponse.json(
          { success: false, error: bookingError.message || "No se pudo crear la reserva" },
          { status: 400 }
        )
      }

      if (!booking) {
        throw new Error("No se pudo crear la reserva")
      }

      const booked = booking as PublicBookingResult

      // Send confirmation email (best-effort).
      if (isEmailConfigured()) {
        try {
          const [{ data: org }, { data: ownerProfile }] = await Promise.all([
            supabaseAdmin
              .from("organizations")
              .select("name")
              .eq("id", booked.organization_id)
              .single(),
            supabaseAdmin
              .from("profiles")
              .select("email, full_name")
              .eq("id", booked.owner_id)
              .single(),
          ])

          const startLabel = slotStart.toLocaleString("es-ES", {
            year: "numeric",
            month: "long",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })
          const endLabel = slotEnd.toLocaleString("es-ES", {
            year: "numeric",
            month: "long",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          })

          const orgName = org?.name || "Nuestro equipo"
          const bookingName = config.name || "Reserva"

          // Attendee confirmation
          await sendEmail({
            to: validation.data.email,
            subject: `Confirmación: ${bookingName}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 20px;">
                <h2 style="margin: 0 0 8px 0;">Reserva confirmada</h2>
                <p style="margin: 0 0 14px 0; color: #334155;">
                  Hola ${escapeHtml(validation.data.name)}, tu reserva con <strong>${escapeHtml(orgName)}</strong> está confirmada.
                </p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                  <p style="margin: 0 0 6px 0;"><strong>Tipo:</strong> ${escapeHtml(bookingName)}</p>
                  <p style="margin: 0 0 6px 0;"><strong>Inicio:</strong> ${escapeHtml(startLabel)}</p>
                  <p style="margin: 0;"><strong>Fin:</strong> ${escapeHtml(endLabel)}</p>
                </div>
                <p style="margin: 14px 0 0 0; font-size: 12px; color: #64748b;">
                  Event ID: ${escapeHtml(booked.event_id)}
                </p>
              </div>
            `,
          })

          // Owner notification (optional)
          if (ownerProfile?.email) {
            await sendEmail({
              to: ownerProfile.email,
              subject: `Nueva reserva: ${bookingName}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #0f172a; max-width: 640px; margin: 0 auto; padding: 20px;">
                  <h2 style="margin: 0 0 8px 0;">Nueva reserva</h2>
                  <p style="margin: 0 0 10px 0; color: #334155;">
                    ${escapeHtml(validation.data.name)} (${escapeHtml(validation.data.email)}) reservó <strong>${escapeHtml(bookingName)}</strong>.
                  </p>
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px;">
                    <p style="margin: 0 0 6px 0;"><strong>Inicio:</strong> ${escapeHtml(startLabel)}</p>
                    <p style="margin: 0;"><strong>Fin:</strong> ${escapeHtml(endLabel)}</p>
                  </div>
                  <p style="margin: 14px 0 0 0; font-size: 12px; color: #64748b;">
                    Event ID: ${escapeHtml(booked.event_id)}
                  </p>
                </div>
              `,
            })
          }
        } catch {
          // Email failures should not break booking creation.
        }
      }

      const response = NextResponse.json({
        success: true,
        data: {
          event_id: booked.event_id,
          start: slotStart,
          end: slotEnd,
        }
      })
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
      return response
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

export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request)
  if (!allowedOrigin) return new NextResponse(null, { status: 403 })
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}
