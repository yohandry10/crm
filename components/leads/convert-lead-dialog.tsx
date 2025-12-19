"use client"

import { useEffect } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, UserCheck, Building2, Target } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

interface ConvertLeadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lead: {
        id: string
        name: string
        email: string
        company?: string
        lead_status: string
    } | null
    onSuccess: () => void
}

export function ConvertLeadDialog({
    open,
    onOpenChange,
    lead,
    onSuccess,
}: ConvertLeadDialogProps) {
    const moneySchema = z.preprocess(
        (v) => (v === "" || v === null || v === undefined ? 0 : v),
        z.coerce.number().min(0, "El monto no puede ser negativo")
    )

    const convertLeadSchema = z.object({
        create_account: z.boolean().default(true),
        create_opportunity: z.boolean().default(true),
        opportunity_name: z.string().max(200, "Máximo 200 caracteres").optional().or(z.literal('')),
        expected_revenue: moneySchema.default(0),
    })

    type ConvertLeadFormData = z.infer<typeof convertLeadSchema>

    const form = useForm<ConvertLeadFormData>({
        resolver: zodResolver(convertLeadSchema),
        defaultValues: {
            create_account: true,
            create_opportunity: true,
            opportunity_name: "",
            expected_revenue: 0,
        },
        mode: "onChange",
    })

    const { handleSubmit, reset, watch, formState: { isSubmitting } } = form
    const createOpportunity = watch("create_opportunity")

    useEffect(() => {
        if (!open) return
        reset({
            create_account: Boolean(lead?.company),
            create_opportunity: true,
            opportunity_name: "",
            expected_revenue: 0,
        })
    }, [lead?.company, open, reset])

    const onSubmit = async (values: ConvertLeadFormData) => {
        if (!lead) return

        try {
            const res = await fetch(`/api/contacts/${lead.id}/convert`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    create_account: values.create_account && !!lead.company,
                    create_opportunity: values.create_opportunity,
                    opportunity_name: values.opportunity_name?.trim() || `Oportunidad - ${lead.name}`,
                    expected_revenue: values.expected_revenue || 0,
                }),
            })

            const data = await res.json()

            if (data.success) {
                toast.success("Lead convertido exitosamente")
                if (data.data.account) {
                    toast.info(`Cuenta creada: ${data.data.account.name || lead.company}`)
                }
                if (data.data.opportunity) {
                    toast.info("Oportunidad creada en el pipeline")
                }
                onOpenChange(false)
                onSuccess()
            } else {
                toast.error(data.error || "Error al convertir lead")
            }
        } catch {
            toast.error("Error al convertir lead")
        }
    }

    if (!lead) return null

    const canConvert = lead.lead_status !== "converted" && lead.lead_status !== "lost"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-green-600" />
                        Convertir Lead a Cliente
                    </DialogTitle>
                    <DialogDescription>
                        Convierte a <strong>{lead.name}</strong> en cliente.
                        {!canConvert && (
                            <span className="block mt-2 text-orange-600">
                                Este lead ya está {lead.lead_status === "converted" ? "convertido" : "perdido"}.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                {canConvert && (
                    <Form {...form}>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
                        {/* Crear Cuenta */}
                        {lead.company && (
                            <FormField
                                control={form.control}
                                name="create_account"
                                render={({ field }) => (
                                    <FormItem className="flex items-start space-x-3 p-3 border rounded-lg">
                                        <FormControl>
                                            <Checkbox
                                                id="create_account"
                                                checked={!!field.value}
                                                onCheckedChange={(checked) => field.onChange(!!checked)}
                                            />
                                        </FormControl>
                                        <div className="space-y-1">
                                            <FormLabel htmlFor="create_account" className="flex items-center gap-2 cursor-pointer">
                                                <Building2 className="w-4 h-4" />
                                                Crear Cuenta Empresarial
                                            </FormLabel>
                                            <p className="text-sm text-muted-foreground">
                                                Se creará la cuenta: <strong>{lead.company}</strong>
                                            </p>
                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Crear Oportunidad */}
                        <FormField
                            control={form.control}
                            name="create_opportunity"
                            render={({ field }) => (
                                <FormItem className="flex items-start space-x-3 p-3 border rounded-lg">
                                    <FormControl>
                                        <Checkbox
                                            id="create_opportunity"
                                            checked={!!field.value}
                                            onCheckedChange={(checked) => field.onChange(!!checked)}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 flex-1">
                                        <FormLabel htmlFor="create_opportunity" className="flex items-center gap-2 cursor-pointer">
                                            <Target className="w-4 h-4" />
                                            Crear Oportunidad de Venta
                                        </FormLabel>
                                        <p className="text-sm text-muted-foreground">
                                            Se agregará al pipeline de ventas
                                        </p>
                                        <FormMessage />
                                    </div>
                                </FormItem>
                            )}
                        />

                        {/* Detalles de Oportunidad */}
                        {createOpportunity && (
                            <div className="space-y-3 pl-6 border-l-2 border-primary/20">
                                <FormField
                                    control={form.control}
                                    name="opportunity_name"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel>Nombre de la Oportunidad</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={`Oportunidad - ${lead.name}`}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="expected_revenue"
                                    render={({ field }) => (
                                        <FormItem className="space-y-2">
                                            <FormLabel>Ingreso Esperado (S/)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    inputMode="decimal"
                                                    placeholder="0.00"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <DialogFooter>
                            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-green-600 hover:bg-green-700">
                                {isSubmitting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <UserCheck className="w-4 h-4 mr-2" />
                                )}
                                Convertir
                            </Button>
                        </DialogFooter>
                        </form>
                    </Form>
                )}

                {!canConvert && (
                    <DialogFooter>
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}
