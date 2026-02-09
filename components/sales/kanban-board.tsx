"use client"

import { useState } from "react"
import { OpportunityCard } from "./opportunity-card"
import { ScrollArea } from "@/components/ui/scroll-area"

import { Plus, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface KanbanBoardProps {
    stages: any[]
    opportunities: any[]
    onMoveOpportunity: (id: string, newStageId: string) => void
    onEditOpportunity: (opportunity: any) => void
    onAddOpportunity: (stageId: string) => void
}

export function KanbanBoard({
    stages,
    opportunities,
    onMoveOpportunity,
    onEditOpportunity,
    onAddOpportunity
}: KanbanBoardProps) {
    const [, setDraggedId] = useState<string | null>(null)

    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedId(id)
        e.dataTransfer.setData("text/plain", id)
        e.dataTransfer.effectAllowed = "move"
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
    }

    const handleDrop = (e: React.DragEvent, stageId: string) => {
        e.preventDefault()
        const id = e.dataTransfer.getData("text/plain")
        if (!id) {
            setDraggedId(null)
            return
        }

        const currentStageId = opportunities.find((opp) => opp.id === id)?.stage_id
        if (currentStageId !== stageId) {
            onMoveOpportunity(id, stageId)
        }

        setDraggedId(null)
    }

    return (
        <div className="flex h-full gap-6 overflow-x-auto pb-6 px-2 pr-6 snap-x snap-mandatory">
            {stages.map((stage) => {
                const stageOpps = opportunities.filter(o => o.stage_id === stage.id)
                const totalValue = stageOpps.reduce((sum, o) => sum + Number(o.expected_revenue), 0)

                return (
                    <div
                        key={stage.id}
                        className="flex-shrink-0 w-[300px] xl:w-[310px] flex flex-col snap-start group select-none"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, stage.id)}
                    >
                        {/* Column Header */}
                        <div className="mb-4">
                            <div className="flex items-center justify-between mb-2 px-1">
                                <div className="flex items-center gap-2.5">
                                    <div
                                        className="w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-sm"
                                        style={{ backgroundColor: stage.color || '#cbd5e1' }}
                                    />
                                    <h3 className="font-bold text-sm text-zinc-700 dark:text-zinc-200 tracking-tight">
                                        {stage.name}
                                    </h3>
                                    <span className="flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                                        {stageOpps.length}
                                    </span>
                                </div>
                                <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                                        onClick={() => onAddOpportunity(stage.id)}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-zinc-400 hover:text-zinc-700"
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => toast.info("Función de editar etapa próximamente")}>
                                                <Pencil className="mr-2 h-4 w-4" />
                                                <span>Editar Etapa</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                onClick={() => toast.warning("No se puede eliminar etapa con oportunidades")}
                                                className="text-red-600 focus:text-red-600"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                <span>Eliminar</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Summary Bar */}
                            <div className={cn(
                                "h-1 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden",
                                totalValue > 0 && "cursor-help"
                            )} title={`Total: S/ ${totalValue}`}>
                                <div
                                    className="h-full rounded-full transition-all duration-500 ease-out"
                                    style={{
                                        width: `${Math.min((totalValue / 10000) * 100, 100)}%`, // Mock progress based on arbitrary goal
                                        backgroundColor: stage.color || '#cbd5e1'
                                    }}
                                />
                            </div>
                            {totalValue > 0 && (
                                <div className="mt-1.5 text-[11px] font-medium text-zinc-400 text-right px-1">
                                    S/ {totalValue.toLocaleString('es-PE')}
                                </div>
                            )}
                        </div>

                        {/* Drop Zone */}
                        <div className="flex-1 bg-zinc-50/50 dark:bg-zinc-900/20 rounded-2xl border border-transparent hover:border-zinc-200/50 dark:hover:border-zinc-800 transition-colors p-2 -mx-2">
                            <ScrollArea className="h-full">
                                <div className="flex flex-col gap-3 min-h-[150px] p-1">
                                    {stageOpps.map((opp) => (
                                        <OpportunityCard
                                            key={opp.id}
                                            opportunity={opp}
                                            onDragStart={handleDragStart}
                                            onClick={onEditOpportunity}
                                        />
                                    ))}
                                    {stageOpps.length === 0 && (
                                        <div className="h-32 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-400 bg-white/50 dark:bg-zinc-900/50">
                                            <div className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800/50">
                                                <Plus className="w-4 h-4 text-zinc-400" />
                                            </div>
                                            <span className="text-xs font-medium">Arrastra o crea aquí</span>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
