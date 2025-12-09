"use client"

import { useState, useEffect } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Plus, MonitorPlay } from "lucide-react"
import Link from "next/link"
import { WorkflowDialog } from "./workflow-dialog"
import { Loading } from "@/components/ui/loading"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"

export function WorkflowsList() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    useEffect(() => {
        loadWorkflows()
    }, [])

    const loadWorkflows = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/workflows")
            const data = await res.json()
            if (data.success) {
                setWorkflows(data.data)
            }
        } catch (error) {
            console.error("Error loading workflows:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setSelectedWorkflow(null)
        setDialogOpen(true)
    }

    const handleEdit = (workflow: any) => {
        setSelectedWorkflow(workflow)
        setDialogOpen(true)
    }

    const handleDeleteClick = (id: string) => {
        setDeleteId(id)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return

        try {
            const res = await fetch(`/api/workflows/${deleteId}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("Workflow eliminado correctamente")
                loadWorkflows()
            } else {
                toast.error("Error al eliminar: " + data.error)
            }
        } catch (error) {
            console.error("Error deleting workflow:", error)
            toast.error("Error al eliminar el workflow")
        } finally {
            setDeleteId(null)
        }
    }

    const handleSave = async (workflowData: any) => {
        try {
            const url = selectedWorkflow
                ? `/api/workflows/${selectedWorkflow.id}`
                : "/api/workflows"

            const method = selectedWorkflow ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(workflowData)
            })

            const data = await res.json()

            if (data.success) {
                loadWorkflows()
            } else {
                throw new Error(data.error)
            }
        } catch (error: any) {
            toast.error("Error al guardar: " + error.message)
            throw error
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={handleCreate} className="gradient-neon border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nuevo Workflow
                </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                    <div className="col-span-full text-center py-8"><Loading text="Cargando workflows..." /></div>
                ) : workflows.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                        No hay workflows configurados
                    </div>
                ) : (
                    workflows.map((workflow) => (
                        <Card key={workflow.id} className="hover:border-primary/50 hover:neon-glow transition-all duration-300">
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg font-bold">{workflow.name}</CardTitle>
                                    <Badge variant={workflow.is_active ? "default" : "secondary"}>
                                        {workflow.is_active ? "Activo" : "Inactivo"}
                                    </Badge>
                                </div>
                                <CardDescription>{workflow.description}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Disparador:</span>
                                        <span className="font-medium">{workflow.trigger_type}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Acciones:</span>
                                        <span className="font-medium">{workflow.actions?.length || 0} pasos</span>
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                                    <Link href={`/workflows/${workflow.id}/builder`} passHref>
                                        <Button variant="outline" size="sm" className="border-primary/50 text-primary hover:bg-primary/10">
                                            <MonitorPlay className="w-4 h-4 mr-2" />
                                            Diseñador
                                        </Button>
                                    </Link>
                                    <Button variant="ghost" size="sm" onClick={() => handleEdit(workflow)}>
                                        <Edit className="w-4 h-4 mr-2" />
                                        Editar
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(workflow.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            <WorkflowDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                workflow={selectedWorkflow}
                onSave={handleSave}
            />

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="¿Eliminar workflow?"
                description="Esta acción no se puede deshacer. El workflow y su historial de ejecuciones serán eliminados permanentemente."
                onConfirm={handleDeleteConfirm}
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    )
}
