"use client"

import { useState } from "react"
import { OpportunityCard } from "./opportunity-card"
import { ScrollArea } from "@/components/ui/scroll-area"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"

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
    const [draggedId, setDraggedId] = useState<string | null>(null)

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
        if (id && id !== draggedId) {
            // Optimistic update handled by parent or local state if needed
            onMoveOpportunity(id, stageId)
        }
        setDraggedId(null)
    }

    return (
        <div className="flex h-full gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
                const stageOpps = opportunities.filter(o => o.stage_id === stage.id)
                const totalValue = stageOpps.reduce((sum, o) => sum + Number(o.expected_revenue), 0)

                return (
                    <div
                        key={stage.id}
                        className="flex-shrink-0 w-80 flex flex-col bg-card rounded-xl border shadow-sm"
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, stage.id)}
                    >
                        {/* Column Header */}
                        <div className="p-4 border-b bg-muted/30 rounded-t-xl flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: stage.color || '#cbd5e1' }}
                                />
                                <h3 className="font-semibold text-sm">{stage.name}</h3>
                                <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded-md border">
                                    {stageOpps.length}
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onAddOpportunity(stage.id)}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Column Summary */}
                        {totalValue > 0 && (
                            <div className="px-3 py-2 text-xs font-medium text-muted-foreground border-b bg-background/50">
                                Total: {new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(totalValue)}
                            </div>
                        )}

                        {/* Drop Zone */}
                        <ScrollArea className="flex-1 p-2">
                            <div className="flex flex-col gap-2 min-h-[150px]">
                                {stageOpps.map((opp) => (
                                    <OpportunityCard
                                        key={opp.id}
                                        opportunity={opp}
                                        onDragStart={handleDragStart}
                                        onClick={onEditOpportunity}
                                    />
                                ))}
                                {stageOpps.length === 0 && (
                                    <div className="h-24 border-2 border-dashed border-primary/20 rounded-xl flex items-center justify-center text-xs text-muted-foreground bg-primary/5">
                                        Arrastra aquí
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                )
            })}
        </div>
    )
}
