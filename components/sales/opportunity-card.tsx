"use client"

import { Calendar, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface OpportunityCardProps {
    opportunity: any
    onDragStart: (e: React.DragEvent, id: string) => void
    onClick: (opportunity: any) => void
}

export function OpportunityCard({ opportunity, onDragStart, onClick }: OpportunityCardProps) {
    const probability = opportunity.probability || 0
    const contactName = opportunity.contact_name || opportunity.contact?.name || "Sin contacto"
    const amount = opportunity.expected_revenue || 0

    // Color logic for probability
    const getProbColor = (prob: number) => {
        if (prob >= 75) return "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-200"
        if (prob >= 40) return "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-200"
        return "bg-slate-500/15 text-slate-700 hover:bg-slate-500/25 border-slate-200"
    }

    return (
        <motion.div
            layoutId={opportunity.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            whileHover={{ y: -2, transition: { duration: 0.2 } }}
            className="group relative bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800 p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing select-none"
            draggable
            onDragStart={(e) => {
                // native drag needed for HTML5 dnd api that the board uses
                // Cast to React.DragEvent since framer-motion has different event types
                onDragStart(e as unknown as React.DragEvent, opportunity.id)
            }}
            onClick={() => onClick(opportunity)}
        >
            {/* Top Row: Name & Probability */}
            <div className="flex justify-between items-start gap-3 mb-2">
                <h4 className="font-semibold text-sm text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2">
                    {opportunity.name}
                </h4>
                <Badge
                    variant="outline"
                    className={cn("px-1.5 py-0 h-5 text-[10px] border-0 font-semibold tracking-wide shrink-0", getProbColor(probability))}
                >
                    {probability}%
                </Badge>
            </div>

            {/* Middle Row: Amount */}
            <div className="flex items-center gap-1.5 mb-3">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                    <DollarSign className="w-3.5 h-3.5" />
                </div>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                    {amount.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}
                </span>
            </div>

            {/* Footer: Contact & Date */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-1">
                <div className="flex items-center gap-1.5">
                    <Avatar className="w-5 h-5 border border-zinc-100">
                        <AvatarFallback className="text-[9px] bg-zinc-100 text-zinc-500">
                            {contactName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate max-w-[80px]">
                        {contactName}
                    </span>
                </div>

                {opportunity.expected_close_date && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 font-medium">
                        <Calendar className="w-3 h-3" />
                        <span>
                            {new Date(opportunity.expected_close_date).toLocaleDateString('es-PE', {
                                day: '2-digit',
                                month: 'short'
                            })}
                        </span>
                    </div>
                )}
            </div>

            {/* Left accent border based on probability */}
            <div className={cn(
                "absolute left-0 top-3 bottom-3 w-0.5 rounded-r-full opacity-60",
                probability >= 75 ? "bg-emerald-500" : probability >= 40 ? "bg-amber-500" : "bg-slate-300"
            )} />
        </motion.div>
    )
}
