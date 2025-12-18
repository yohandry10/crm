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
import { WORKFLOW_TRIGGERS, WORKFLOW_TRIGGER_OPTIONS } from "@/lib/workflow-constants"
// ✅ FEATURE: Template variables helper
import { TemplateVariablesHelper } from "./template-variables-helper"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { createWorkflowSchema } from "@/lib/schemas"

interface WorkflowDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    workflow?: any
    onSave: (workflow: any) => void
}

export function WorkflowDialog({ open, onOpenChange, workflow, onSave }: WorkflowDialogProps) {
    const [loading, setLoading] = useState(false)

    const jsonObjectStringSchema = z.string().refine((value) => {
        try {
            const parsed = JSON.parse(value || "{}")
            return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        } catch {
            return false
        }
    }, "JSON inválido (se espera un objeto)")

    const jsonArrayStringSchema = z.string().refine((value) => {
        try {
            const parsed = JSON.parse(value || "[]")
            return Array.isArray(parsed)
        } catch {
            return false
        }
    }, "JSON inválido (se espera un array)")

    const workflowDialogSchema = z.object({
        name: z.string().min(1, "Nombre requerido").max(200),
        description: z.string().optional().nullable().or(z.literal('')),
        trigger_type: z.enum(WORKFLOW_TRIGGERS).default("contact.created"),
        is_active: z.boolean().default(true),
        trigger_conditions_json: jsonObjectStringSchema.default("{}"),
        actions_json: jsonArrayStringSchema.default("[]"),
    })

    type WorkflowDialogFormData = z.infer<typeof workflowDialogSchema>

    const {
        register,
        handleSubmit,
        watch,
        reset,
        setValue,
        formState: { errors },
    } = useForm<WorkflowDialogFormData>({
        resolver: zodResolver(workflowDialogSchema),
        defaultValues: {
            name: "",
            description: "",
            trigger_type: "contact.created",
            is_active: true,
            trigger_conditions_json: "{}",
            actions_json: "[]",
        },
    })

    const watchedTriggerType = watch("trigger_type")

    useEffect(() => {
        if (workflow) {
            reset({
                name: workflow.name || "",
                description: workflow.description || "",
                trigger_type: workflow.trigger_type || "contact.created",
                is_active: workflow.is_active ?? true,
                trigger_conditions_json: JSON.stringify(workflow.trigger_conditions ?? {}, null, 2),
                actions_json: JSON.stringify(workflow.actions ?? [], null, 2),
            })
        } else {
            reset({
                name: "",
                description: "",
                trigger_type: "contact.created", // ✅ FIX: Valor válido según schema
                trigger_conditions_json: "{}",
                actions_json: "[]",
                is_active: true,
            })
        }
    }, [workflow, open])

    const onSubmit = async (data: WorkflowDialogFormData) => {
        setLoading(true)
        try {
            // Parse JSON fields
            const payload = {
                name: data.name,
                description: data.description || null,
                trigger_type: data.trigger_type,
                trigger_conditions: JSON.parse(data.trigger_conditions_json || "{}"),
                actions: JSON.parse(data.actions_json || "[]"),
                is_active: data.is_active,
            }

            const validation = createWorkflowSchema.safeParse(payload)
            if (!validation.success) {
                window.alert("Error: workflow inválido (acciones/trigger/params)")
                return
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
                <form onSubmit={handleSubmit(onSubmit)}>
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
                                {...register("name")}
                            />
                            {errors.name && (
                                <p className="text-sm text-destructive">{errors.name.message}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="description">Descripción</Label>
                            <Input
                                id="description"
                                {...register("description")}
                            />
                            {errors.description && (
                                <p className="text-sm text-destructive">{errors.description.message}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="trigger_type">Tipo de Disparador</Label>
                                {/* ✅ FIX WF-006: Usar opciones centralizadas */}
                                <Select
                                    value={watchedTriggerType || "contact.created"}
                                    onValueChange={(value) => setValue("trigger_type", value as any, { shouldValidate: true })}
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
                                {errors.trigger_type && (
                                    <p className="text-sm text-destructive">{errors.trigger_type.message}</p>
                                )}
                            </div>
                            <div className="flex items-center space-x-2 pt-8">
                                <Switch
                                    id="is_active"
                                    checked={!!watch("is_active")}
                                    onCheckedChange={(checked) => setValue("is_active", checked, { shouldValidate: true })}
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
                                <TemplateVariablesHelper triggerType={watchedTriggerType || "contact.created"} />
                            </div>
                        </div>
                        {/* Advanced fields hidden for visual builder simplicity */}
                        <div className="hidden">
                            <Label htmlFor="trigger_conditions">Condiciones (JSON)</Label>
                            <Textarea
                                id="trigger_conditions"
                                className="font-mono text-xs"
                                rows={4}
                                {...register("trigger_conditions_json")}
                            />
                            {errors.trigger_conditions_json && (
                                <p className="text-sm text-destructive">{errors.trigger_conditions_json.message}</p>
                            )}
                        </div>
                        <div className="hidden">
                            <Label htmlFor="actions">Acciones (JSON)</Label>
                            <Textarea
                                id="actions"
                                className="font-mono text-xs"
                                rows={4}
                                {...register("actions_json")}
                            />
                            {errors.actions_json && (
                                <p className="text-sm text-destructive">{errors.actions_json.message}</p>
                            )}
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
