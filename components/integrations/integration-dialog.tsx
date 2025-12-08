"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

interface IntegrationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    integration?: any
    onSave: (integration: any) => Promise<any>
}

export function IntegrationDialog({ open, onOpenChange, integration, onSave }: IntegrationDialogProps) {
    const [formData, setFormData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (integration) {
            setFormData({
                ...integration,
                config: JSON.stringify(integration.config, null, 2)
            })
        } else {
            setFormData({
                name: "",
                provider: "whatsapp",
                description: "",
                category: "communication",
                status: "disconnected",
                config: "{}"
            })
        }
    }, [integration, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const payload = {
                ...formData,
                config: JSON.parse(formData.config)
            }
            const result = await onSave(payload)

            if (result?.connection) {
                if (result.connection.success) {
                    toast.success(result.connection.message)
                } else {
                    toast.warning(`Guardado, pero falló la conexión: ${result.connection.message}`)
                }
            }

            onOpenChange(false)
        } catch (error) {
            console.error("Error saving integration:", error)
            toast.error("Error: JSON inválido en configuración")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{integration ? "Configurar Integración" : "Nueva Integración"}</DialogTitle>
                        <DialogDescription>
                            Conecta servicios externos a tu CRM.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre</Label>
                                <Input
                                    id="name"
                                    value={formData.name || ""}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="provider">Proveedor</Label>
                                <Select
                                    value={formData.provider || "whatsapp"}
                                    onValueChange={(value) => setFormData({ ...formData, provider: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar proveedor" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                                        <SelectItem value="lms">LMS (Canvas/Moodle)</SelectItem>
                                        <SelectItem value="concar">Concar (Contabilidad)</SelectItem>
                                        <SelectItem value="google">Google Workspace</SelectItem>
                                        <SelectItem value="other">Otro API</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Input
                                id="description"
                                value={formData.description || ""}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="category">Categoría</Label>
                                <Select
                                    value={formData.category || "communication"}
                                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar categoría" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="communication">Comunicación</SelectItem>
                                        <SelectItem value="finance">Finanzas</SelectItem>
                                        <SelectItem value="analytics">Analítica</SelectItem>
                                        <SelectItem value="education">Educación</SelectItem>
                                        <SelectItem value="other">Otros</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Estado Inicial</Label>
                                <Select
                                    value={formData.status || "disconnected"}
                                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar estado" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="connected">Conectado</SelectItem>
                                        <SelectItem value="disconnected">Desconectado</SelectItem>
                                        <SelectItem value="error">Error</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="config">Configuración (JSON)</Label>
                            <Textarea
                                id="config"
                                className="font-mono text-xs"
                                rows={6}
                                value={formData.config || "{}"}
                                onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Ingresa las credenciales o API keys en formato JSON.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Guardando..." : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
