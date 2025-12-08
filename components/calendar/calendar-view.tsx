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
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, MoreHorizontal } from "lucide-react"
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
        return events.filter(event => isSameDay(new Date(event.start_time), date))
    }

    const handleMonthChange = (newDate: Date, dir: number) => {
        setDirection(dir)
        onDateChange(newDate)
    }

    const variants = {
        enter: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (direction: number) => ({
            x: direction > 0 ? -50 : 50,
            opacity: 0,
            scale: 0.95
        })
    }

    return (
        <div className="flex flex-col h-full bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5 pointer-events-none" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-6 border-b border-gray-100/50 backdrop-blur-md z-10 relative">
                <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white"
                    >
                        <CalendarIcon className="w-6 h-6" />
                    </motion.div>
                    <div>
                        <motion.h2
                            key={currentDate.toISOString()}
                            initial={{ y: -10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-3xl font-bold capitalize bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent"
                        >
                            {format(currentDate, 'MMMM yyyy', { locale: es })}
                        </motion.h2>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-white/50 p-1.5 rounded-xl border border-gray-200/50 shadow-sm backdrop-blur-sm">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMonthChange(subMonths(currentDate, 1), -1)}
                                    className="hover:bg-white hover:shadow-md transition-all duration-300 hover:text-cyan-600 rounded-lg"
                                >
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mes anterior</TooltipContent>
                        </Tooltip>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMonthChange(new Date(), 0)}
                            className="px-4 font-semibold text-gray-700 hover:bg-white hover:text-cyan-600 hover:shadow-md transition-all duration-300 rounded-lg"
                        >
                            Hoy
                        </Button>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleMonthChange(addMonths(currentDate, 1), 1)}
                                    className="hover:bg-white hover:shadow-md transition-all duration-300 hover:text-cyan-600 rounded-lg"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Mes siguiente</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 border-b border-gray-100/50 bg-gray-50/30 backdrop-blur-sm z-10 relative">
                {weekDays.map((day) => (
                    <div key={day} className="py-4 text-center">
                        <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">
                            {day}
                        </span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 relative overflow-hidden bg-gray-50/20">
                <AnimatePresence initial={false} custom={direction} mode="popLayout">
                    <motion.div
                        key={currentDate.toISOString()}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className="grid grid-cols-7 grid-rows-5 lg:grid-rows-6 h-full absolute inset-0"
                    >
                        {days.map((day, index) => {
                            const dayEvents = getEventsForDay(day)
                            const isCurrentMonth = isSameMonth(day, monthStart)
                            const isDayToday = isToday(day)

                            return (
                                <motion.div
                                    key={day.toString()}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: index * 0.005 }}
                                    className={cn(
                                        "border-b border-r border-gray-100/50 p-2 transition-all duration-200 relative group flex flex-col gap-1",
                                        !isCurrentMonth ? "bg-gray-50/50" : "bg-white/40 hover:bg-white/80",
                                        isDayToday && "bg-cyan-50/30"
                                    )}
                                    onClick={() => onDateClick(day)}
                                >
                                    {/* Date Number & Add Button */}
                                    <div className="flex justify-between items-start">
                                        <span className={cn(
                                            "text-sm font-semibold h-8 w-8 flex items-center justify-center rounded-xl transition-all duration-300",
                                            isDayToday
                                                ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-110"
                                                : "text-gray-700 group-hover:bg-white group-hover:shadow-sm",
                                            !isCurrentMonth && "text-gray-300"
                                        )}>
                                            {format(day, 'd')}
                                        </span>

                                        <motion.button
                                            whileHover={{ scale: 1.1, rotate: 90 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-cyan-50 text-cyan-600 rounded-lg"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                onDateClick(day)
                                            }}
                                        >
                                            <Plus className="h-4 w-4" />
                                        </motion.button>
                                    </div>

                                    {/* Events List */}
                                    <div className="flex-1 flex flex-col gap-1.5 mt-1 overflow-y-auto overflow-x-hidden scrollbar-none">
                                        {dayEvents.map((event, i) => {
                                            const eventPast = isBefore(new Date(event.start_time), new Date())

                                            return (
                                                <motion.div
                                                    key={event.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.05 }}
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        onEventClick(event)
                                                    }}
                                                    className={cn(
                                                        "text-xs pl-2 pr-1.5 py-1.5 rounded-lg truncate font-medium border-l-[3px] transition-all cursor-pointer shadow-sm group/event",
                                                        eventPast
                                                            ? "bg-gray-50 border-gray-300 text-gray-400 opacity-60 hover:opacity-100"
                                                            : "bg-white border-cyan-500 text-gray-700 hover:shadow-md hover:shadow-cyan-100 hover:translate-x-0.5"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-1">
                                                        <span className="truncate flex-1">
                                                            {event.title}
                                                        </span>
                                                        {!event.all_day && (
                                                            <span className="text-[10px] opacity-70 font-mono shrink-0">
                                                                {format(new Date(event.start_time), 'HH:mm')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )
                                        })}

                                        {/* More events indicator if needed - could be added if length > 3 */}
                                    </div>

                                    {/* Today Indicator Line */}
                                    {isDayToday && (
                                        <motion.div
                                            layoutId="today-indicator"
                                            className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]"
                                        />
                                    )}
                                </motion.div>
                            )
                        })}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    )
}
