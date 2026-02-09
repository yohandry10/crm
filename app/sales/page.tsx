"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { KanbanBoard } from "@/components/sales/kanban-board"
import { OpportunityDialog } from "@/components/sales/opportunity-dialog"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

export default function SalesPage() {
    const [stages, setStages] = useState<any[]>([])
    const [opportunities, setOpportunities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedOpportunity, setSelectedOpportunity] = useState<any>(null)
    const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined)

    const fetchData = async () => {
        setLoading(true)
        try {
            const [stagesRes, oppsRes] = await Promise.all([
                fetch('/api/pipeline-stages'),
                fetch('/api/opportunities')
            ])

            if (!stagesRes.ok || !oppsRes.ok) throw new Error('Failed to fetch data')

            const stagesData = await stagesRes.json()
            const oppsData = await oppsRes.json()

            setStages(stagesData.data || [])
            setOpportunities(oppsData.data || [])
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar datos del pipeline")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [])

    const handleMoveOpportunity = async (id: string, newStageId: string) => {
        // Optimistic update
        const originalOpps = [...opportunities]
        setOpportunities(prev => prev.map(o =>
            o.id === id ? { ...o, stage_id: newStageId } : o
        ))

        try {
            const res = await fetch(`/api/opportunities/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stage_id: newStageId })
            })

            if (!res.ok) throw new Error('Update failed')

            // Optional: Refresh to get updated totals/metadata if needed
        } catch {
            // Revert on error
            setOpportunities(originalOpps)
            toast.error("Error al mover la oportunidad")
        }
    }

    const handleAddOpportunity = (stageId?: string) => {
        setSelectedOpportunity(null)
        setDefaultStageId(stageId)
        setDialogOpen(true)
    }

    const handleEditOpportunity = (opportunity: any) => {
        setSelectedOpportunity(opportunity)
        setDialogOpen(true)
    }

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-2rem)]">
                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                    <div className="space-y-1">
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Pipeline de Ventas</h1>
                        <p className="text-sm text-zinc-500 font-medium">
                            Gestiona y monitorea tus oportunidades en tiempo real
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <TutorialButton moduleId="opportunities" />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchData}
                            className="bg-white hover:bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 transition-colors"
                        >
                            <RefreshCw className="h-4 w-4 text-zinc-600" />
                        </Button>
                        <Button
                            onClick={() => handleAddOpportunity()}
                            className="shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 gradient-neon border-0 text-white"
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Oportunidad
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="flex flex-col items-center gap-4">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                                <span className="text-sm text-zinc-400 font-medium animate-pulse">Cargando pipeline...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full min-h-0 p-8 bg-gradient-to-br from-zinc-50/50 to-white/50 dark:from-zinc-950 dark:to-zinc-900/50">
                            <KanbanBoard
                                stages={stages}
                                opportunities={opportunities}
                                onMoveOpportunity={handleMoveOpportunity}
                                onEditOpportunity={handleEditOpportunity}
                                onAddOpportunity={handleAddOpportunity}
                            />
                        </div>
                    )}
                </div>

                <OpportunityDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    opportunity={selectedOpportunity}
                    stages={stages}
                    defaultStageId={defaultStageId}
                    onSuccess={fetchData}
                />
            </div>
        </DashboardLayout>
    )
}
