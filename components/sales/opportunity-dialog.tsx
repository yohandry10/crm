"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

const formSchema = z.object({
    name: z.string().min(2, "El nombre es requerido"),
    expected_revenue: z.coerce.number().min(0, "El valor debe ser positivo"),
    stage_id: z.string().min(1, "La etapa es requerida"),
    contact_id: z.string().min(1, "El contacto es requerido"),
    expected_close_date: z.string().optional(),
    probability: z.coerce.number().min(0).max(100).optional(),
    description: z.string().optional(),
})

interface OpportunityDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    opportunity?: any
    stages: any[]
    defaultStageId?: string
    onSuccess: () => void
}

export function OpportunityDialog({
    open,
    onOpenChange,
    opportunity,
    stages,
    defaultStageId,
    onSuccess
}: OpportunityDialogProps) {
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            expected_revenue: 0,
            stage_id: defaultStageId || "",
            contact_id: "",
            expected_close_date: "",
            probability: 50,
            description: "",
        },
    })

    // Load contacts and set initial values
    useEffect(() => {
        const loadContacts = async () => {
            const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser')
            const supabase = getSupabaseBrowserClient()
            const { data } = await supabase.from('contacts').select('id, name').order('name')
            if (data) setContacts(data)
        }
        loadContacts().catch(console.error)

        if (opportunity) {
            form.reset({
                name: opportunity.name,
                expected_revenue: opportunity.expected_revenue,
                stage_id: opportunity.stage_id,
                contact_id: opportunity.contact_id,
                expected_close_date: opportunity.expected_close_date || "",
                probability: opportunity.probability,
                description: opportunity.description || "",
            })
        } else {
            form.reset({
                name: "",
                expected_revenue: 0,
                stage_id: defaultStageId || (stages[0]?.id || ""),
                contact_id: "",
                expected_close_date: "",
                probability: 50,
                description: "",
            })
        }
    }, [open, opportunity, defaultStageId, stages, form])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const response = await fetch(
                opportunity ? `/api/opportunities/${opportunity.id}` : '/api/opportunities',
                {
                    method: opportunity ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(values),
                }
            )

            if (!response.ok) throw new Error('Failed to save opportunity')

            onSuccess()
            onOpenChange(false)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {opportunity ? "Editar Oportunidad" : "Nueva Oportunidad"}
                    </DialogTitle>
                    <DialogDescription>
                        {opportunity ? "Modifica los detalles de la venta." : "Crea una nueva oportunidad de venta en el pipeline."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre de la Oportunidad</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Venta de Software CRM" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="expected_revenue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor Estimado (S/)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="probability"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Probabilidad (%)</FormLabel>
                                        <FormControl>
                                            <Input type="number" min="0" max="100" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="stage_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Etapa</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona etapa" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {stages.map((stage) => (
                                                    <SelectItem key={stage.id} value={stage.id}>
                                                        {stage.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="contact_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contacto</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona cliente" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {contacts.map((contact) => (
                                                    <SelectItem key={contact.id} value={contact.id}>
                                                        {contact.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="expected_close_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha Cierre Estimada</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar Oportunidad"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
