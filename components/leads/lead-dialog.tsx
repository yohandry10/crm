"use client"

import { useEffect, useState, useRef } from "react"
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
    name: z.string().min(2, "Nombre requerido"),
    email: z.string().email("Email inválido"),
    phone: z.string().optional(),
    lead_status: z.enum(["cold", "warm", "hot", "converted", "lost"]),
    lead_source_id: z.string().optional(),
    campaign_id: z.string().optional(),
})

const defaultFormValues = {
    name: "",
    email: "",
    phone: "",
    lead_status: "cold" as const,
    lead_source_id: "none",
    campaign_id: "none",
}

interface LeadDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    lead?: any
    onSuccess: () => void
}

export function LeadDialog({
    open,
    onOpenChange,
    lead,
    onSuccess
}: LeadDialogProps) {
    const [sources, setSources] = useState<any[]>([])
    const [campaigns, setCampaigns] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const dataFetchedRef = useRef(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: defaultFormValues,
    })

    // Fetch sources y campaigns via API (multi-tenant seguro)
    useEffect(() => {
        if (dataFetchedRef.current) return
        
        Promise.all([
            fetch('/api/lead-sources').then(r => r.json()),
            fetch('/api/campaigns').then(r => r.json())
        ]).then(([sourcesRes, campaignsRes]) => {
            if (sourcesRes.data) setSources(sourcesRes.data)
            if (campaignsRes.data) setCampaigns(campaignsRes.data)
            dataFetchedRef.current = true
        }).catch(console.error)
    }, [])

    // Reset form cuando cambia el lead o se abre el dialog
    useEffect(() => {
        if (!open) return
        
        if (lead) {
            form.reset({
                name: lead.name,
                email: lead.email,
                phone: lead.phone || "",
                lead_status: lead.lead_status || "cold",
                lead_source_id: lead.lead_source_id || "none",
                campaign_id: lead.campaign_id || "none",
            })
        } else {
            form.reset(defaultFormValues)
        }
    }, [open, lead]) // ✅ Removido 'form' de dependencias - form.reset es estable

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const payload = {
                ...values,
                lead_source_id: values.lead_source_id === "none" ? null : values.lead_source_id,
                campaign_id: values.campaign_id === "none" ? null : values.campaign_id,
                is_lead: true
            }

            const response = await fetch(
                lead ? `/api/contacts/${lead.id}` : '/api/contacts',
                {
                    method: lead ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )

            if (!response.ok) throw new Error('Failed to save lead')

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
                        {lead ? "Editar Lead" : "Nuevo Lead"}
                    </DialogTitle>
                    <DialogDescription>
                        Gestiona la información de tus prospectos.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nombre Completo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Juan Pérez" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email</FormLabel>
                                        <FormControl>
                                            <Input placeholder="juan@ejemplo.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Teléfono</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+51 999..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="lead_status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Estado del Lead</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona estado" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="cold">Frío</SelectItem>
                                            <SelectItem value="warm">Tibio</SelectItem>
                                            <SelectItem value="hot">Caliente</SelectItem>
                                            <SelectItem value="converted">Convertido</SelectItem>
                                            <SelectItem value="lost">Perdido</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="lead_source_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fuente</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Origen" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguna</SelectItem>
                                                {sources.map((s) => (
                                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="campaign_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Campaña</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Campaña" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguna</SelectItem>
                                                {campaigns.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Guardando..." : "Guardar Lead"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
