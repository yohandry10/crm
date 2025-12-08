"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { CalendarView } from "@/components/calendar/calendar-view"
import { EventDialog } from "@/components/calendar/event-dialog"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function CalendarPage() {
    const [events, setEvents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentDate])

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
                <div className="flex items-center justify-between pb-6 border-b">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Calendario</h1>
                        <p className="text-muted-foreground">
                            Agenda reuniones, llamadas y eventos importantes
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="calendar" />
                        <Button variant="outline" size="icon" onClick={fetchEvents}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleAddEvent} className="gradient-neon border-0">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Evento
                        </Button>
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
