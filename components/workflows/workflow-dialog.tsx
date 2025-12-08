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
import { Switch } from "@/components/ui/switch"

interface WorkflowDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workflow?: any
    onSave: (workflow: any) => void
}

export function WorkflowDialog({ open, onOpenChange, workflow, onSave }: WorkflowDialogProps) {
    const [formData, setFormData] = useState<any>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (workflow) {
            setFormData({
                ...workflow,
                trigger_conditions: JSON.stringify(workflow.trigger_conditions, null, 2),
                actions: JSON.stringify(workflow.actions, null, 2)
            })
        } else {
            setFormData({
                name: "",
                description: "",
                trigger_type: "contact.created", // ✅ FIX: Valor válido según schema
                trigger_conditions: "{}",
                actions: "[]",
                is_active: true
            })
        }
    }, [workflow, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Parse JSON fields
            const payload = {
                ...formData,
                trigger_conditions: JSON.parse(formData.trigger_conditions),
                actions: JSON.parse(formData.actions)
            }
            await onSave(payload)
            onOpenChange(false)
        } catch (error) {
            console.error("Error saving workflow:", error)
            // Note: Using native alert here is intentional for JSON parse errors
            // as toast may not be visible when dialog is open
            window.alert("Error: JSON inválido en condiciones o acciones")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>{workflow ? "Editar Workflow" : "Nuevo Workflow"}</DialogTitle>
                        <DialogDescription>
                            Configura las reglas de automatización.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
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
                            <Label htmlFor="description">Descripción</Label>
                            <Input
                                id="description"
                                value={formData.description || ""}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="trigger_type">Tipo de Disparador</Label>
                                {/* ✅ FIX: Sincronizado con lib/schemas.ts trigger_type enum */}
                                <Select
                                    value={formData.trigger_type || "contact.created"}
                                    onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contact.created">Contacto Creado</SelectItem>
                                        <SelectItem value="contact.updated">Contacto Actualizado</SelectItem>
                                        <SelectItem value="invoice.sent">Factura Enviada</SelectItem>
                                        <SelectItem value="invoice.paid">Factura Pagada</SelectItem>
                                        <SelectItem value="payment.completed">Pago Completado</SelectItem>
                                        <SelectItem value="opportunity.created">Oportunidad Creada</SelectItem>
                                        <SelectItem value="opportunity.updated">Oportunidad Actualizada</SelectItem>
                                        <SelectItem value="task.created">Tarea Creada</SelectItem>
                                        <SelectItem value="task.completed">Tarea Completada</SelectItem>
                                        <SelectItem value="ticket.created">Ticket Creado</SelectItem>
                                        <SelectItem value="ticket.resolved">Ticket Resuelto</SelectItem>
                                        <SelectItem value="campaign.created">Campaña Creada</SelectItem>
                                        <SelectItem value="quote.created">Cotización Creada</SelectItem>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="schedule">Programado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                                <Switch
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                                <Label htmlFor="is_active">Activo</Label>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="trigger_conditions">Condiciones (JSON)</Label>
                            <Textarea
                                id="trigger_conditions"
                                className="font-mono text-xs"
                                rows={4}
                                value={formData.trigger_conditions || "{}"}
                                onChange={(e) => setFormData({ ...formData, trigger_conditions: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">Ej: {"{ \"min_score\": 80 }"}</p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="actions">Acciones (JSON)</Label>
                            <Textarea
                                id="actions"
                                className="font-mono text-xs"
                                rows={4}
                                value={formData.actions || "[]"}
                                onChange={(e) => setFormData({ ...formData, actions: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">Ej: {"[{ \"type\": \"send_email\", \"template\": \"welcome\" }]"}</p>
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
