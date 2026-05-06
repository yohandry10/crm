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
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"

const formSchema = z.object({
    title: z.string().min(2, "El título es requerido"),
    start_time: z.string().min(1, "Fecha inicio requerida"),
    end_time: z.string().min(1, "Fecha fin requerida"),
    all_day: z.boolean().default(false),
    location: z.string().optional(),
    description: z.string().optional(),
    contact_id: z.string().optional(),
    opportunity_id: z.string().optional(),
})

interface EventDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    event?: any
    selectedDate?: Date
    onSuccess: () => void
}

export function EventDialog({
    open,
    onOpenChange,
    event,
    selectedDate,
    onSuccess
}: EventDialogProps) {
    const [contacts, setContacts] = useState<any[]>([])
    const [opportunities, setOpportunities] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            start_time: "",
            end_time: "",
            all_day: false,
            location: "",
            description: "",
            contact_id: "none",
            opportunity_id: "none",
        },
    })

    useEffect(() => {
        // Cargar contactos y oportunidades via API (respeta multi-tenant)
        Promise.all([
            fetch('/api/contacts?limit=100').then(r => r.json()),
            fetch('/api/opportunities?status=open&limit=100').then(r => r.json())
        ]).then(([contactsRes, oppsRes]) => {
            if (contactsRes.success && contactsRes.data) setContacts(contactsRes.data)
            if (oppsRes.success && oppsRes.data) setOpportunities(oppsRes.data)
        }).catch(console.error)

        if (event) {
            form.reset({
                title: event.title,
                start_time: new Date(event.start_time).toISOString().slice(0, 16),
                end_time: new Date(event.end_time).toISOString().slice(0, 16),
                all_day: event.all_day,
                location: event.location || "",
                description: event.description || "",
                contact_id: event.contact_id || "none",
                opportunity_id: event.opportunity_id || "none",
            })
        } else {
            const start = selectedDate ? new Date(selectedDate) : new Date()
            start.setHours(9, 0, 0, 0)
            const end = new Date(start)
            end.setHours(10, 0, 0, 0)

            form.reset({
                title: "",
                start_time: start.toISOString().slice(0, 16),
                end_time: end.toISOString().slice(0, 16),
                all_day: false,
                location: "",
                description: "",
                contact_id: "none",
                opportunity_id: "none",
            })
        }
    }, [open, event, selectedDate, form])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const payload = {
                title: values.title,
                description: values.description,
                location: values.location,
                contact_id: values.contact_id === "none" ? null : values.contact_id,
                opportunity_id: values.opportunity_id === "none" ? null : values.opportunity_id,
                start: new Date(values.start_time).toISOString(),
                end: new Date(values.end_time).toISOString(),
            }

            const response = await fetch(
                event ? `/api/calendar/events/${event.id}` : '/api/calendar/events',
                {
                    method: event ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Error al guardar evento')
            }

            toast.success(event ? "Evento actualizado" : "Evento creado")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            console.error(error)
            toast.error(error.message || "Error al guardar evento")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>
                        {event ? "Editar Evento" : "Nuevo Evento"}
                    </DialogTitle>
                    <DialogDescription>
                        {event ? "Modifica los detalles del evento." : "Programa una reunión o evento en el calendario."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Título</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Reunión con cliente" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="start_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Inicio</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="end_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Fin</FormLabel>
                                        <FormControl>
                                            <Input type="datetime-local" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="all_day"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Todo el día</FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="contact_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contacto</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona (opcional)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguno</SelectItem>
                                                {contacts.map((c) => (
                                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="opportunity_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Oportunidad</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona (opcional)" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Ninguna</SelectItem>
                                                {opportunities.map((o) => (
                                                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
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
                            name="location"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Ubicación / Link</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Oficina / Google Meet" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripción</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Agenda de la reunión..." {...field} />
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
                                {loading ? "Guardando..." : "Guardar Evento"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
