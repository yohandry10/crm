"use client"

import { useState, useEffect } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Plus, Settings, Trash2 } from "lucide-react"
import { IntegrationDialog } from "./integration-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"

export function IntegrationsGrid() {
    const [integrations, setIntegrations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedIntegration, setSelectedIntegration] = useState<any>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)

    useEffect(() => {
        loadIntegrations()
    }, [])

    const loadIntegrations = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/integrations")
            const data = await res.json()
            if (data.success) {
                setIntegrations(data.data)
            }
        } catch (error) {
            console.error("Error loading integrations:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleCreate = () => {
        setSelectedIntegration(null)
        setDialogOpen(true)
    }

    const handleEdit = (integration: any) => {
        setSelectedIntegration(integration)
        setDialogOpen(true)
    }

    const handleDeleteClick = (id: string) => {
        setDeleteId(id)
    }

    const handleDeleteConfirm = async () => {
        if (!deleteId) return

        try {
            const res = await fetch(`/api/integrations/${deleteId}`, { method: "DELETE" })
            const data = await res.json()
            if (data.success) {
                toast.success("Integración eliminada correctamente")
                loadIntegrations()
            } else {
                toast.error("Error al eliminar: " + data.error)
            }
        } catch (error) {
            console.error("Error deleting integration:", error)
            toast.error("Error al eliminar la integración")
        } finally {
            setDeleteId(null)
        }
    }

    const handleSave = async (integrationData: any) => {
        try {
            const url = selectedIntegration
                ? `/api/integrations/${selectedIntegration.id}`
                : "/api/integrations"

            const method = selectedIntegration ? "PUT" : "POST"

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(integrationData)
            })

            const data = await res.json()

            if (data.success) {
                loadIntegrations()
                return data
            } else {
                throw new Error(data.error)
            }
        } catch (error: any) {
            toast.error("Error al guardar: " + error.message)
            throw error
        }
    }

    const toggleStatus = async (integration: any) => {
        const newStatus = integration.status === "connected" ? "disconnected" : "connected"
        try {
            const res = await fetch(`/api/integrations/${integration.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...integration, status: newStatus })
            })
            const data = await res.json()
            if (data.success) {
                loadIntegrations()
            }
        } catch (error) {
            console.error("Error toggling status:", error)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "connected": return "bg-emerald-500"
            case "disconnected": return "bg-slate-500"
            case "error": return "bg-rose-500"
            default: return "bg-slate-500"
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={handleCreate} className="gradient-neon border-0">
                    <Plus className="w-4 h-4 mr-2" />
                    Nueva Integración
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {loading ? (
                    <div className="col-span-full text-center py-8">Cargando integraciones...</div>
                ) : integrations.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-muted-foreground">
                        No hay integraciones configuradas
                    </div>
                ) : (
                    integrations.map((integration) => (
                        <Card key={integration.id} className="flex flex-col hover:border-primary/50 hover:neon-glow transition-all duration-300">
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <CardTitle className="text-lg font-bold">{integration.name}</CardTitle>
                                    <Badge className={`${getStatusColor(integration.status)} text-white border-0`}>
                                        {integration.status}
                                    </Badge>
                                </div>
                                <CardDescription>{integration.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Proveedor:</span>
                                        <span className="font-medium capitalize">{integration.provider}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Categoría:</span>
                                        <span className="font-medium capitalize">{integration.category}</span>
                                    </div>
                                    {integration.last_sync && (
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Última Sync:</span>
                                            <span className="font-medium text-xs">
                                                {new Date(integration.last_sync).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                            <CardFooter className="border-t pt-4 flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        checked={integration.status === "connected"}
                                        onCheckedChange={() => toggleStatus(integration)}
                                    />
                                    <span className="text-sm text-muted-foreground">
                                        {integration.status === "connected" ? "On" : "Off"}
                                    </span>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="ghost" size="icon" onClick={() => handleEdit(integration)}>
                                        <Settings className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(integration.id)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </CardFooter>
                        </Card>
                    ))
                )}
            </div>

            <IntegrationDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                integration={selectedIntegration}
                onSave={handleSave}
            />

            <ConfirmDialog
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title="¿Eliminar integración?"
                description="Esta acción desconectará la integración y eliminará su configuración."
                onConfirm={handleDeleteConfirm}
                confirmText="Eliminar"
                cancelText="Cancelar"
            />
        </div>
    )
}
