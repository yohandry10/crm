"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CalendarView } from "@/components/calendar/calendar-view"
import { EventDialog } from "@/components/calendar/event-dialog"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw, Link as LinkIcon } from "lucide-react"
import { toast } from "sonner"

export default function CalendarPage() {
    const [events, setEvents] = useState<any[]>([])
    const [bookingConfigs, setBookingConfigs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [loadingBookings, setLoadingBookings] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedEvent, setSelectedEvent] = useState<any>(null)
    const [selectedDate, setSelectedDate] = useState<Date>(new Date())
    const [currentDate, setCurrentDate] = useState<Date>(new Date())

    const fetchEvents = async () => {
        setLoading(true)
        try {
            // Fetch events for current month view (plus buffer)
            const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1).toISOString()
            const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0).toISOString()

            const res = await fetch(`/api/events?start=${start}&end=${end}`)
            if (!res.ok) throw new Error('Failed to fetch events')
            const data = await res.json()
            setEvents(data.data || [])
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar eventos")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchEvents()
        fetchBookings()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate])

    const fetchBookings = async () => {
        setLoadingBookings(true)
        try {
            const res = await fetch('/api/calendar/booking')
            if (!res.ok) throw new Error('No se pudieron cargar los enlaces de booking')
            const data = await res.json()
            setBookingConfigs(data.data || [])
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar enlaces de booking")
        } finally {
            setLoadingBookings(false)
        }
    }

    const handleCreateBookingLink = async () => {
        setLoadingBookings(true)
        try {
            const body = {
                name: "Link de booking 30min",
                duration: 30,
                buffer: 10,
                available_days: [1, 2, 3, 4, 5], // L-V
                available_hours: { start: "09:00", end: "17:00" },
                max_advance_days: 30,
                questions: [],
                is_active: true
            }
            const res = await fetch('/api/calendar/booking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
            if (!res.ok) throw new Error('No se pudo crear el link de booking')
            toast.success('Link de booking creado')
            await fetchBookings()
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Error creando link de booking")
        } finally {
            setLoadingBookings(false)
        }
    }

    const handleDateClick = (date: Date) => {
        setSelectedDate(date)
        setSelectedEvent(null)
        setDialogOpen(true)
    }

    const handleEventClick = (event: any) => {
        setSelectedEvent(event)
        setDialogOpen(true)
    }

    const handleAddEvent = () => {
        setSelectedDate(new Date())
        setSelectedEvent(null)
        setDialogOpen(true)
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground">Calendario</h1>
                        <p className="text-muted-foreground">
                            Agenda reuniones, llamadas y eventos importantes
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="calendar" />
                        <Button variant="outline" size="icon" onClick={fetchEvents}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleAddEvent} className="gradient-neon border-0 text-white">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Evento
                        </Button>
                    </div>
                </div>

                {/* Booking público */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 px-6 py-4">
                    <div className="col-span-1 lg:col-span-3 bg-card dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">Enlaces públicos de booking</h2>
                                <p className="text-sm text-muted-foreground">Genera un link para que tus clientes agenden reuniones.</p>
                            </div>
                            <Button size="sm" onClick={handleCreateBookingLink} disabled={loadingBookings} variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Nuevo enlace
                            </Button>
                        </div>
                        <div className="space-y-2">
                            {loadingBookings ? (
                                <p className="text-sm text-muted-foreground">Cargando...</p>
                            ) : bookingConfigs.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Aún no tienes enlaces de booking.</p>
                            ) : (
                                bookingConfigs.map((config) => (
                                    <div key={config.id} className="flex items-center justify-between border border-border dark:border-zinc-800 rounded-lg p-3 bg-background dark:bg-zinc-950/50">
                                        <div>
                                            <p className="font-medium text-foreground">{config.name}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {config.available_hours?.start} - {config.available_hours?.end} · {config.duration} min · {Array.isArray(config.available_days) ? config.available_days.length : 0} días
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <a
                                                className="text-sm text-primary hover:underline flex items-center gap-1"
                                                href={`/book/${config.id}`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                <LinkIcon className="w-4 h-4" />
                                                Abrir
                                            </a>
                                            <a
                                                className="text-sm text-muted-foreground hover:underline"
                                                href={`/api/calendar/booking?config_id=${config.id}&date=${new Date().toISOString().slice(0, 10)}`}
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                Ver slots
                                            </a>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-hidden">
                    {loading && events.length === 0 ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <CalendarView
                            events={events}
                            currentDate={currentDate}
                            onDateChange={setCurrentDate}
                            onDateClick={handleDateClick}
                            onEventClick={handleEventClick}
                        />
                    )}
                </div>

                <EventDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    event={selectedEvent}
                    selectedDate={selectedDate}
                    onSuccess={fetchEvents}
                />
            </div>
        </DashboardLayout>
    )
}
