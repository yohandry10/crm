/**
 * Calendar Integration & Booking System
 * Soporta: Google Calendar, Outlook Calendar
 */

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  start: Date
  end: Date
  location?: string
  attendees?: { email: string; name?: string; status?: 'accepted' | 'declined' | 'tentative' }[]
  meetingLink?: string
  reminders?: { method: 'email' | 'popup'; minutes: number }[]
  contactId?: string
  opportunityId?: string
}

export interface BookingSlot {
  start: Date
  end: Date
  available: boolean
}

export interface BookingConfig {
  id: string
  name: string
  duration: number // minutes
  buffer: number // minutes between meetings
  availableDays: number[] // 0-6, Sunday-Saturday
  availableHours: { start: string; end: string } // "09:00", "18:00"
  timezone: string
  maxAdvanceDays: number
  questions?: { id: string; question: string; required: boolean }[]
}

/**
 * Google Calendar Client
 */
export class GoogleCalendarClient {
  private accessToken: string
  private baseUrl = 'https://www.googleapis.com/calendar/v3'

  constructor(accessToken: string) {
    this.accessToken = accessToken
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error?.message || `Calendar API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Lista eventos del calendario
   */
  async listEvents(params: {
    calendarId?: string
    timeMin?: Date
    timeMax?: Date
    maxResults?: number
  }): Promise<CalendarEvent[]> {
    const calendarId = params.calendarId || 'primary'
    const searchParams = new URLSearchParams()
    
    if (params.timeMin) searchParams.set('timeMin', params.timeMin.toISOString())
    if (params.timeMax) searchParams.set('timeMax', params.timeMax.toISOString())
    if (params.maxResults) searchParams.set('maxResults', params.maxResults.toString())
    searchParams.set('singleEvents', 'true')
    searchParams.set('orderBy', 'startTime')

    const data = await this.request(`/calendars/${calendarId}/events?${searchParams.toString()}`)
    return data.items.map(this.parseGoogleEvent)
  }

  /**
   * Crea un evento
   */
  async createEvent(event: Omit<CalendarEvent, 'id'>, calendarId = 'primary'): Promise<CalendarEvent> {
    const googleEvent = {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: event.start.toISOString(),
        timeZone: 'America/Lima',
      },
      end: {
        dateTime: event.end.toISOString(),
        timeZone: 'America/Lima',
      },
      location: event.location,
      attendees: event.attendees?.map(a => ({ email: a.email, displayName: a.name })),
      conferenceData: event.meetingLink ? undefined : {
        createRequest: { requestId: `meet-${Date.now()}` },
      },
      reminders: {
        useDefault: false,
        overrides: event.reminders || [
          { method: 'email', minutes: 60 },
          { method: 'popup', minutes: 15 },
        ],
      },
    }

    const data = await this.request(`/calendars/${calendarId}/events?conferenceDataVersion=1`, {
      method: 'POST',
      body: JSON.stringify(googleEvent),
    })

    return this.parseGoogleEvent(data)
  }

  /**
   * Actualiza un evento
   */
  async updateEvent(eventId: string, updates: Partial<CalendarEvent>, calendarId = 'primary'): Promise<CalendarEvent> {
    const googleEvent: any = {}
    if (updates.title) googleEvent.summary = updates.title
    if (updates.description) googleEvent.description = updates.description
    if (updates.start) googleEvent.start = { dateTime: updates.start.toISOString(), timeZone: 'America/Lima' }
    if (updates.end) googleEvent.end = { dateTime: updates.end.toISOString(), timeZone: 'America/Lima' }
    if (updates.location) googleEvent.location = updates.location

    const data = await this.request(`/calendars/${calendarId}/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(googleEvent),
    })

    return this.parseGoogleEvent(data)
  }

  /**
   * Elimina un evento
   */
  async deleteEvent(eventId: string, calendarId = 'primary'): Promise<void> {
    await this.request(`/calendars/${calendarId}/events/${eventId}`, {
      method: 'DELETE',
    })
  }

  /**
   * Obtiene slots disponibles para booking
   */
  async getAvailableSlots(config: BookingConfig, date: Date): Promise<BookingSlot[]> {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    // Verificar si el día está disponible
    if (!config.availableDays.includes(date.getDay())) {
      return []
    }

    // Obtener eventos existentes
    const events = await this.listEvents({
      timeMin: dayStart,
      timeMax: dayEnd,
    })

    // Generar slots
    const slots: BookingSlot[] = []
    const [startHour, startMin] = config.availableHours.start.split(':').map(Number)
    const [endHour, endMin] = config.availableHours.end.split(':').map(Number)

    let currentTime = new Date(date)
    currentTime.setHours(startHour, startMin, 0, 0)

    const endTime = new Date(date)
    endTime.setHours(endHour, endMin, 0, 0)

    while (currentTime < endTime) {
      const slotEnd = new Date(currentTime.getTime() + config.duration * 60000)
      
      if (slotEnd > endTime) break

      // Verificar si el slot está disponible
      const isAvailable = !events.some(event => {
        const eventStart = new Date(event.start)
        const eventEnd = new Date(event.end)
        return (currentTime < eventEnd && slotEnd > eventStart)
      })

      slots.push({
        start: new Date(currentTime),
        end: slotEnd,
        available: isAvailable && currentTime > new Date(), // No mostrar slots pasados
      })

      // Siguiente slot (duración + buffer)
      currentTime = new Date(currentTime.getTime() + (config.duration + config.buffer) * 60000)
    }

    return slots
  }

  private parseGoogleEvent(data: any): CalendarEvent {
    return {
      id: data.id,
      title: data.summary || '(Sin título)',
      description: data.description,
      start: new Date(data.start?.dateTime || data.start?.date),
      end: new Date(data.end?.dateTime || data.end?.date),
      location: data.location,
      attendees: data.attendees?.map((a: any) => ({
        email: a.email,
        name: a.displayName,
        status: a.responseStatus,
      })),
      meetingLink: data.hangoutLink || data.conferenceData?.entryPoints?.[0]?.uri,
    }
  }
}

/**
 * Genera link de booking público
 */
export function generateBookingLink(configId: string, baseUrl: string): string {
  return `${baseUrl}/book/${configId}`
}

/**
 * Configuraciones de booking predefinidas
 */
export const DEFAULT_BOOKING_CONFIGS: Partial<BookingConfig>[] = [
  {
    name: 'Llamada de 15 minutos',
    duration: 15,
    buffer: 5,
  },
  {
    name: 'Reunión de 30 minutos',
    duration: 30,
    buffer: 10,
  },
  {
    name: 'Demo de producto (45 min)',
    duration: 45,
    buffer: 15,
  },
  {
    name: 'Consultoría (1 hora)',
    duration: 60,
    buffer: 15,
  },
]
