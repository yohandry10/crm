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
        } catch (error) {
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
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between pb-6 border-b">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Sales Pipeline</h1>
                        <p className="text-muted-foreground">
                            Gestiona tus oportunidades de venta y seguimiento
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="opportunities" />
                        <Button variant="outline" size="icon" onClick={fetchData}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleAddOpportunity()} className="gradient-neon border-0">
                            <Plus className="mr-2 h-4 w-4" />
                            Nueva Oportunidad
                        </Button>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-6 bg-muted/10">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    ) : (
                        <KanbanBoard
                            stages={stages}
                            opportunities={opportunities}
                            onMoveOpportunity={handleMoveOpportunity}
                            onEditOpportunity={handleEditOpportunity}
                            onAddOpportunity={handleAddOpportunity}
                        />
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
