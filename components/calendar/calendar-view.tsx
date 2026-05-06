"use client"

import { useState } from "react"
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
    isToday,
    isBefore
} from "date-fns"
import { es } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

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
    const [direction, setDirection] = useState(0)

    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

    const days = eachDayOfInterval({ start: startDate, end: endDate })
    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

    const getEventsForDay = (date: Date) => {
        return events
            .filter(event => isSameDay(new Date(event.start_time), date))
            .sort((a, b) => {
                const startDiff = new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
                if (startDiff !== 0) return startDiff

                return new Date(b.created_at || b.updated_at || b.start_time).getTime() -
                    new Date(a.created_at || a.updated_at || a.start_time).getTime()
            })
    }

    const handleMonthChange = (newDate: Date, dir: number) => {
        setDirection(dir)
        onDateChange(newDate)
    }

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 20 : -20,
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -20 : 20,
            opacity: 0,
        })
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10 relative">
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <CalendarIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleMonthChange(subMonths(currentDate, 1), -1)}
                                    className="h-9 w-9"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mes anterior</TooltipContent>
                        </Tooltip>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMonthChange(new Date(), 0)}
                            className="h-9 px-4 font-medium"
                        >
                            Hoy
                        </Button>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => handleMonthChange(addMonths(currentDate, 1), 1)}
                                    className="h-9 w-9"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mes siguiente</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/50">
                {weekDays.map((day) => (
                    <div key={day} className="py-3 text-center border-r border-gray-100 dark:border-zinc-800 last:border-0">
                        <span className="text-xs font-semibold tracking-wider text-gray-500 dark:text-gray-400 uppercase">
                            {day}
                        </span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 relative overflow-hidden bg-white dark:bg-zinc-900">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={currentDate.toISOString()}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="grid grid-cols-7 grid-rows-5 lg:grid-rows-6 h-full absolute inset-0"
                    >
                        {days.map((day) => {
                            const dayEvents = getEventsForDay(day)
                            const isCurrentMonth = isSameMonth(day, monthStart)
                            const isDayToday = isToday(day)

                            return (
                                <div
                                    key={day.toString()}
                                    className={cn(
                                        "border-b border-r border-gray-100 dark:border-zinc-800 p-2 transition-colors relative group flex flex-col gap-1 min-h-[100px]",
                                        !isCurrentMonth ? "bg-gray-50/30 dark:bg-zinc-900/30 text-gray-400" : "bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800/50",
                                        isDayToday && "bg-blue-50/30 dark:bg-blue-900/10"
                                    )}
                                    onClick={() => onDateClick(day)}
                                >
                                    {/* Date Number & Add Button */}
                                    <div className="flex justify-between items-start mb-1">
                                        <span className={cn(
                                            "text-sm font-medium h-7 w-7 flex items-center justify-center rounded-full transition-all",
                                            isDayToday
                                                ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                                : "text-gray-700 dark:text-gray-300",
                                            !isCurrentMonth && "text-gray-300 dark:text-gray-600"
                                        )}>
                                            {format(day, 'd')}
                                        </span>

                                        <button
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 rounded-md"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDateClick(day)
                                            }}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                        </button>
                                    </div>

                                    {/* Events List */}
                                    <div className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden scrollbar-none">
                                        {dayEvents.slice(0, 4).map((event) => {
                                            const eventPast = isBefore(new Date(event.start_time), new Date())

                                            return (
                                                <div
                                                    key={event.id}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onEventClick(event)
                                                    }}
                                                    className={cn(
                                                        "text-[10px] px-2 py-1 rounded truncate font-medium cursor-pointer transition-colors border shadow-sm",
                                                        eventPast
                                                            ? "bg-gray-100 border-gray-200 text-gray-500 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400 opacity-70"
                                                            : "bg-blue-50 border-blue-100 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/30 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={cn(
                                                            "w-1.5 h-1.5 rounded-full shrink-0",
                                                            eventPast ? "bg-gray-400" : "bg-blue-500"
                                                        )} />
                                                        <span className="truncate">
                                                            {event.title}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {dayEvents.length > 4 && (
                                            <div className="text-[10px] text-gray-400 pl-1">
                                                +{dayEvents.length - 4} más
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
