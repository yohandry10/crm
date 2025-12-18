"use client"

import { useEffect, useMemo } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

interface IntegrationDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    integration?: any
    onSave: (integration: any) => Promise<any>
}

export function IntegrationDialog({ open, onOpenChange, integration, onSave }: IntegrationDialogProps) {
    const jsonObjectStringSchema = z.string().refine((value) => {
        try {
            const parsed = JSON.parse(value || "{}")
            return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        } catch {
            return false
        }
    }, "JSON inválido (se espera un objeto)")

    const integrationDialogSchema = z.object({
        name: z.string().min(1, "Nombre requerido").max(100),
        provider: z.string().min(1, "Proveedor requerido").max(50),
        description: z.string().max(200).optional().or(z.literal('')),
        category: z.string().min(1, "Categoría requerida").max(50),
        status: z.enum(["connected", "disconnected", "error"]).default("disconnected"),
        is_active: z.boolean().default(true),
        config_json: jsonObjectStringSchema.default("{}"),
    })

    type IntegrationDialogFormData = z.infer<typeof integrationDialogSchema>

    const defaultValues = useMemo<IntegrationDialogFormData>(() => {
        const base: IntegrationDialogFormData = {
            name: "",
            provider: "whatsapp",
            description: "",
            category: "communication",
            status: "disconnected",
            is_active: true,
            config_json: "{}",
        }

        if (!integration) return base

        let config_json = "{}"
        try {
            const cfg = (integration as any).config ?? {}
            config_json = JSON.stringify(cfg, null, 2)
        } catch {
            config_json = "{}"
        }

        return {
            ...base,
            name: integration.name ?? "",
            provider: integration.provider ?? "whatsapp",
            description: integration.description ?? "",
            category: integration.category ?? "communication",
            status: (integration.status as any) ?? "disconnected",
            is_active: integration.is_active ?? true,
            config_json,
        }
    }, [integration])

    const form = useForm<IntegrationDialogFormData>({
        resolver: zodResolver(integrationDialogSchema),
        defaultValues,
        mode: "onChange",
    })

    const { handleSubmit, reset, formState: { isSubmitting } } = form

    useEffect(() => {
        reset(defaultValues)
    }, [defaultValues, open, reset])

    const onSubmit = async (data: IntegrationDialogFormData) => {
        try {
            const payload = {
                ...integration,
                name: data.name,
                provider: data.provider,
                description: data.description || null,
                category: data.category,
                status: data.status,
                is_active: data.is_active,
                config: JSON.parse(data.config_json || "{}"),
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
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{integration ? "Configurar Integración" : "Nueva Integración"}</DialogTitle>
                    <DialogDescription>
                        Conecta servicios externos a tu CRM.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid gap-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nombre</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="provider"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Proveedor</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar proveedor" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="whatsapp">WhatsApp Business</SelectItem>
                                                    <SelectItem value="lms">LMS (Canvas/Moodle)</SelectItem>
                                                    <SelectItem value="concar">Concar (Contabilidad)</SelectItem>
                                                    <SelectItem value="google">Google Workspace</SelectItem>
                                                    <SelectItem value="other">Otro API</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descripción</FormLabel>
                                        <FormControl>
                                            <Input {...field} value={field.value ?? ""} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Categoría</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar categoría" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="communication">Comunicación</SelectItem>
                                                    <SelectItem value="finance">Finanzas</SelectItem>
                                                    <SelectItem value="analytics">Analítica</SelectItem>
                                                    <SelectItem value="education">Educación</SelectItem>
                                                    <SelectItem value="other">Otros</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Estado Inicial</FormLabel>
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Seleccionar estado" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="connected">Conectado</SelectItem>
                                                    <SelectItem value="disconnected">Desconectado</SelectItem>
                                                    <SelectItem value="error">Error</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="config_json"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Configuración (JSON)</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                className="font-mono text-xs"
                                                rows={6}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                        <p className="text-xs text-muted-foreground">
                                            Ingresa las credenciales o API keys en formato JSON.
                                        </p>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Guardando..." : "Guardar"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
