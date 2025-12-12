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
// ✅ FIX WF-006: Importar constantes centralizadas
import { WORKFLOW_TRIGGER_OPTIONS } from "@/lib/workflow-constants"
// ✅ FEATURE: Template variables helper
import { TemplateVariablesHelper } from "./template-variables-helper"

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
                                {/* ✅ FIX WF-006: Usar opciones centralizadas */}
                                <Select
                                    value={formData.trigger_type || "contact.created"}
                                    onValueChange={(value) => setFormData({ ...formData, trigger_type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {WORKFLOW_TRIGGER_OPTIONS.map(option => (
                                            <SelectItem key={option.value} value={option.value}>
                                                {option.label}
                                            </SelectItem>
                                        ))}
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
                        {/* ✅ FEATURE: Template variables helper */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-blue-900 mb-1">
                                        💡 Usa Variables Dinámicas
                                    </p>
                                    <p className="text-xs text-blue-700">
                                        Personaliza tus acciones con datos del evento usando <code className="bg-blue-100 px-1 py-0.5 rounded">{`{{variable}}`}</code>
                                    </p>
                                </div>
                                <TemplateVariablesHelper triggerType={formData.trigger_type || "contact.created"} />
                            </div>
                        </div>
                        {/* Advanced fields hidden for visual builder simplicity */}
                        <div className="hidden">
                            <Label htmlFor="trigger_conditions">Condiciones (JSON)</Label>
                            <Textarea
                                id="trigger_conditions"
                                className="font-mono text-xs"
                                rows={4}
                                value={formData.trigger_conditions || "{}"}
                                onChange={(e) => setFormData({ ...formData, trigger_conditions: e.target.value })}
                            />
                        </div>
                        <div className="hidden">
                            <Label htmlFor="actions">Acciones (JSON)</Label>
                            <Textarea
                                id="actions"
                                className="font-mono text-xs"
                                rows={4}
                                value={formData.actions || "[]"}
                                onChange={(e) => setFormData({ ...formData, actions: e.target.value })}
                            />
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
