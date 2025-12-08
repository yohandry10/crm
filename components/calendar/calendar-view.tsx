"use client"

import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
    isToday
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface CalendarViewProps {
    events: any[]
    onDateClick: (date: Date) => void
    onEventClick: (event: any) => void
    currentDate: Date
    onDateChange: (date: Date) => void
}

export function CalendarView({
    events,
    onDateClick,
    onEventClick,
    currentDate,
    onDateChange
}: CalendarViewProps) {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days = eachDayOfInterval({ start: startDate, end: endDate })

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    const getEventsForDay = (date: Date) => {
        return events.filter(event => isSameDay(new Date(event.start_time), date))
    }

    return (
        <div className="flex flex-col h-full border rounded-lg bg-background shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold capitalize">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </h2>
                    <div className="flex items-center border rounded-md">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDateChange(subMonths(currentDate, 1))}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDateChange(new Date())}
                        >
                            Hoy
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDateChange(addMonths(currentDate, 1))}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 border-b bg-muted/40">
                {weekDays.map(day => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">
                        {day}
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6">
                {days.map((day) => {
                    const dayEvents = getEventsForDay(day)
                    return (
                        <div
                            key={day.toString()}
                            className={cn(
                                "min-h-[100px] border-b border-r p-2 transition-colors hover:bg-muted/20 cursor-pointer relative group",
                                !isSameMonth(day, monthStart) && "bg-muted/10 text-muted-foreground",
                                isToday(day) && "bg-primary/5"
                            )}
                            onClick={() => onDateClick(day)}
                        >
                            <div className="flex justify-between items-start">
                                <span className={cn(
                                    "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full",
                                    isToday(day) && "bg-primary text-primary-foreground"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 group-hover:opacity-100 -mt-1 -mr-1"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDateClick(day)
                                    }}
                                >
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>

                            <div className="mt-1 space-y-1">
                                {dayEvents.map(event => (
                                    <div
                                        key={event.id}
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onEventClick(event)
                                        }}
                                        className="text-xs p-1 rounded bg-primary/10 text-primary truncate border border-primary/20 hover:bg-primary/20 transition-colors"
                                    >
                                        {format(new Date(event.start_time), 'HH:mm')} {event.title}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
