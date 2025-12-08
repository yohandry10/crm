"use client"

import { useState, useCallback, memo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DollarSign,
  Calendar,
  User,
  MoreHorizontal,
  Plus,
  GripVertical
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface Opportunity {
  id: string
  name: string
  expected_revenue: number
  probability: number
  stage_id: string
  contact_name?: string
  contact_email?: string
  expected_close_date?: string
  owner_name?: string
  created_at: string
  // Alias for backward compatibility
  value?: number
}

interface KanbanStage {
  id: string
  name: string
  color: string
  probability: number
}

const DEFAULT_STAGES: KanbanStage[] = [
  { id: "prospecting", name: "Prospección", color: "bg-slate-500", probability: 10 },
  { id: "qualification", name: "Calificación", color: "bg-blue-500", probability: 25 },
  { id: "proposal", name: "Propuesta", color: "bg-yellow-500", probability: 50 },
  { id: "negotiation", name: "Negociación", color: "bg-orange-500", probability: 75 },
  { id: "closed_won", name: "Ganado", color: "bg-green-500", probability: 100 },
  { id: "closed_lost", name: "Perdido", color: "bg-red-500", probability: 0 },
]

interface KanbanBoardProps {
  opportunities: Opportunity[]
  stages?: KanbanStage[]
  onStageChange: (opportunityId: string, newStage: string) => Promise<void>
  onEdit: (opportunity: Opportunity) => void
  onDelete: (opportunityId: string) => void
  onCreate: () => void
}

export function KanbanBoard({
  opportunities,
  stages = DEFAULT_STAGES,
  onStageChange,
  onEdit,
  onDelete,
  onCreate,
}: KanbanBoardProps) {
  const [draggedItem, setDraggedItem] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)

  // Debug logs
  console.log("=== KANBAN DEBUG ===")
  console.log("Stages:", stages.map(s => ({ id: s.id, name: s.name })))
  console.log("Opportunities:", opportunities.map(o => ({ id: o.id, name: o.name, stage_id: o.stage_id })))

  const getOpportunitiesByStage = useCallback((stageId: string) => {
    const filtered = opportunities.filter(opp => opp.stage_id === stageId)
    console.log(`Stage ${stageId}: ${filtered.length} opportunities`)
    return filtered
  }, [opportunities])

  const calculateStageValue = useCallback((stageId: string) => {
    return getOpportunitiesByStage(stageId).reduce((sum, opp) => sum + (opp.expected_revenue || opp.value || 0), 0)
  }, [getOpportunitiesByStage])

  const calculateWeightedValue = useCallback((stageId: string) => {
    const stage = stages.find(s => s.id === stageId)
    if (!stage) return 0
    return getOpportunitiesByStage(stageId).reduce(
      (sum, opp) => sum + ((opp.expected_revenue || opp.value || 0) * (opp.probability || stage.probability) / 100),
      0
    )
  }, [getOpportunitiesByStage, stages])

  const totalPipelineValue = opportunities.reduce((sum, opp) => sum + (opp.expected_revenue || opp.value || 0), 0)
  const totalWeightedValue = opportunities.reduce((sum, opp) => {
    const stage = stages.find(s => s.id === opp.stage_id)
    const value = opp.expected_revenue || opp.value || 0
    return sum + (value * (opp.probability || stage?.probability || 0) / 100)
  }, 0)

  const handleDragStart = (e: React.DragEvent, opportunityId: string) => {
    setDraggedItem(opportunityId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    setDragOverStage(stageId)
  }

  const handleDragLeave = () => {
    setDragOverStage(null)
  }

  const handleDrop = async (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    if (draggedItem) {
      await onStageChange(draggedItem, stageId)
    }
    setDraggedItem(null)
    setDragOverStage(null)
  }

  return (
    <div className="space-y-4">
      {/* Header con métricas */}
      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div>
            <p className="text-sm text-muted-foreground">Pipeline Total</p>
            <p className="text-2xl font-bold">S/ {totalPipelineValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Valor Ponderado</p>
            <p className="text-2xl font-bold text-green-600">S/ {totalWeightedValue.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Oportunidades</p>
            <p className="text-2xl font-bold">{opportunities.length}</p>
          </div>
        </div>
        <Button onClick={onCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva Oportunidad
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            opportunities={getOpportunitiesByStage(stage.id)}
            stageValue={calculateStageValue(stage.id)}
            weightedValue={calculateWeightedValue(stage.id)}
            isDragOver={dragOverStage === stage.id}
            onDragOver={(e) => handleDragOver(e, stage.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, stage.id)}
            onDragStart={handleDragStart}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
}

interface KanbanColumnProps {
  stage: KanbanStage
  opportunities: Opportunity[]
  stageValue: number
  weightedValue: number
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onEdit: (opportunity: Opportunity) => void
  onDelete: (id: string) => void
}

const KanbanColumn = memo(function KanbanColumn({
  stage,
  opportunities,
  stageValue,
  weightedValue,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onEdit,
  onDelete,
}: KanbanColumnProps) {
  return (
    <div
      className={cn(
        "flex-shrink-0 w-72 bg-muted/50 rounded-lg p-3 transition-colors",
        isDragOver && "bg-primary/10 ring-2 ring-primary"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-3 h-3 rounded-full", stage.color)} />
          <h3 className="font-medium text-sm">{stage.name}</h3>
          <Badge variant="secondary" className="text-xs">
            {opportunities.length}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{stage.probability}%</span>
      </div>

      {/* Column Stats */}
      <div className="text-xs text-muted-foreground mb-3 space-y-1">
        <div className="flex justify-between">
          <span>Total:</span>
          <span className="font-medium">S/ {stageValue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Ponderado:</span>
          <span className="font-medium text-green-600">S/ {weightedValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2 min-h-[200px]">
        {opportunities.map((opp) => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            onDragStart={onDragStart}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  )
})

interface OpportunityCardProps {
  opportunity: Opportunity
  onDragStart: (e: React.DragEvent, id: string) => void
  onEdit: (opportunity: Opportunity) => void
  onDelete: (id: string) => void
}

const OpportunityCard = memo(function OpportunityCard({
  opportunity,
  onDragStart,
  onEdit,
  onDelete,
}: OpportunityCardProps) {
  return (
    <Card
      draggable
      onDragStart={(e) => onDragStart(e, opportunity.id)}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm line-clamp-1">{opportunity.name}</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(opportunity)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(opportunity.id)}
                className="text-red-600"
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <DollarSign className="w-4 h-4 text-green-600" />
          <span className="font-bold">S/ {(opportunity.expected_revenue || opportunity.value || 0).toLocaleString()}</span>
          <Badge variant="outline" className="text-xs ml-auto">
            {opportunity.probability}%
          </Badge>
        </div>

        {opportunity.contact_name && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <User className="w-3 h-3" />
            <span className="truncate">{opportunity.contact_name}</span>
          </div>
        )}

        {opportunity.expected_close_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-3 h-3" />
            <span>{new Date(opportunity.expected_close_date).toLocaleDateString('es-PE')}</span>
          </div>
        )}

        {opportunity.owner_name && (
          <div className="flex items-center gap-2">
            <Avatar className="w-5 h-5">
              <AvatarFallback className="text-[10px]">
                {opportunity.owner_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">{opportunity.owner_name}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
})

export { DEFAULT_STAGES }
