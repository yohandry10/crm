"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { KanbanBoard, Opportunity, DEFAULT_STAGES } from "@/components/opportunities/kanban-board"
import { OpportunityDialog } from "@/components/opportunities/opportunity-dialog"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { RefreshCw, Search } from "lucide-react"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { KanbanModuleSkeleton } from '@/components/ui/module-skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function PipelinePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedOpportunity, setSelectedOpportunity] = useState<Opportunity | null>(null)
  const [search, setSearch] = useState("")
  const [ownerFilter, setOwnerFilter] = useState<string>("all")
  const [users, setUsers] = useState<any[]>([])
  const [opportunityToDelete, setOpportunityToDelete] = useState<string | null>(null)
  const [stages, setStages] = useState<any[]>([])

  const fetchStages = async () => {
    try {
      const res = await fetch("/api/pipeline-stages")
      if (res.ok) {
        const data = await res.json()
        if (data.data && data.data.length > 0) {
          setStages(data.data.map((s: any) => ({
            id: s.id,
            name: s.name,
            color: s.color || "bg-slate-500",
            probability: s.win_probability || 0
          })))
        }
      }
    } catch (error) {
      console.error("Error fetching stages:", error)
    }
  }

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (ownerFilter !== "all") params.set("owner_id", ownerFilter)

      const res = await fetch(`/api/opportunities?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setOpportunities(data.data || [])
    } catch {
      toast.error("Error al cargar oportunidades")
    } finally {
      setLoading(false)
    }
  }, [search, ownerFilter])

  const fetchUsers = async () => {
    try {
      const res = await fetch("/api/team")
      if (res.ok) {
        const data = await res.json()
        // Transform team members to user format for the filter
        const members = data.data?.members || []
        setUsers(members.map((m: any) => ({
          id: m.user_id,
          full_name: m.profiles?.full_name,
          email: m.profiles?.email
        })))
      }
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    fetchStages()
    fetchOpportunities()
    fetchUsers()
  }, [fetchOpportunities])

  const handleStageChange = async (opportunityId: string, newStageId: string) => {
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: newStageId }),
      })

      if (!res.ok) throw new Error("Failed to update")

      const data = await res.json()

      // Update local state with response data
      setOpportunities(prev =>
        prev.map(opp =>
          opp.id === opportunityId
            ? { ...opp, stage_id: newStageId, probability: data.data?.probability || DEFAULT_STAGES.find(s => s.id === newStageId)?.probability || opp.probability }
            : opp
        )
      )

      toast.success("Etapa actualizada")
    } catch {
      toast.error("Error al actualizar")
      fetchOpportunities() // Refresh on error
    }
  }

  const handleEdit = (opportunity: Opportunity) => {
    setSelectedOpportunity(opportunity)
    setDialogOpen(true)
  }

  const handleDelete = async (opportunityId: string) => {
    try {
      const res = await fetch(`/api/opportunities/${opportunityId}`, {
        method: "DELETE",
      })

      if (!res.ok) throw new Error("Failed to delete")

      setOpportunities(prev => prev.filter(opp => opp.id !== opportunityId))
      toast.success("Oportunidad eliminada")
    } catch {
      toast.error("Error al eliminar")
    } finally {
      setOpportunityToDelete(null)
    }
  }

  const handleCreate = () => {
    setSelectedOpportunity(null)
    setDialogOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex items-center justify-between pb-6 border-b">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Pipeline de Ventas</h1>
            <p className="text-muted-foreground">
              Gestiona tus oportunidades con vista Kanban
            </p>
          </div>
          <div className="flex items-center gap-2">
            <TutorialButton moduleId="pipeline" />
            <Button variant="outline" size="icon" onClick={fetchOpportunities}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 py-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar oportunidades..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por vendedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los vendedores</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name || user.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          {loading && opportunities.length === 0 ? (
            <KanbanModuleSkeleton />
          ) : (
            <KanbanBoard
              opportunities={opportunities}
              stages={stages.length > 0 ? stages : undefined}
              onStageChange={handleStageChange}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCreate={handleCreate}
            />
          )}
        </div>

        <OpportunityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          opportunity={selectedOpportunity}
          onSuccess={fetchOpportunities}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={!!opportunityToDelete}
          onOpenChange={(open) => !open && setOpportunityToDelete(null)}
          title="Eliminar Oportunidad"
          description="¿Estás seguro de eliminar esta oportunidad? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="destructive"
          onConfirm={() => opportunityToDelete && handleDelete(opportunityToDelete)}
        />
      </div>
    </DashboardLayout>
  )
}
