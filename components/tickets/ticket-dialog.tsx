"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

const formSchema = z.object({
    title: z.string().min(1, "El titulo es requerido"),
    description: z.string().optional(),
    status: z.enum(["open", "in_progress", "waiting", "resolved", "closed"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    contact_id: z.string().optional(),
    account_id: z.string().optional(),
})

type TicketFormValues = z.infer<typeof formSchema>

type ReferenceItem = {
    id: string
    name: string
}

interface TicketDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    ticket?: any
    mode?: "create" | "edit" | "view"
    onSuccess: () => void
}

export function TicketDialog({
    open,
    onOpenChange,
    ticket,
    mode = "create",
    onSuccess,
}: TicketDialogProps) {
    const [contacts, setContacts] = useState<ReferenceItem[]>([])
    const [accounts, setAccounts] = useState<ReferenceItem[]>([])
    const [loading, setLoading] = useState(false)
    const readOnly = mode === "view"

    const form = useForm<TicketFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            status: "open",
            priority: "medium",
            contact_id: "none",
            account_id: "none",
        },
    })

    useEffect(() => {
        if (!open) return

        const loadReferences = async () => {
            try {
                const [contactsRes, accountsRes] = await Promise.all([
                    fetch("/api/contacts?limit=100").then((res) => res.json()),
                    fetch("/api/accounts?limit=100").then((res) => res.json()),
                ])

                if (contactsRes.success) setContacts(contactsRes.data || [])
                if (accountsRes.success) setAccounts(accountsRes.data || [])
            } catch {
                toast.error("No se pudieron cargar contactos o cuentas")
            }
        }

        void loadReferences()
    }, [open])

    useEffect(() => {
        if (ticket) {
            form.reset({
                title: ticket.title || "",
                description: ticket.description || "",
                status: ticket.status || "open",
                priority: ticket.priority || "medium",
                contact_id: ticket.contact_id || "none",
                account_id: ticket.account_id || "none",
            })
        } else {
            form.reset({
                title: "",
                description: "",
                status: "open",
                priority: "medium",
                contact_id: "none",
                account_id: "none",
            })
        }
    }, [ticket, form, open])

    const onSubmit = async (values: TicketFormValues) => {
        if (readOnly) return

        setLoading(true)
        try {
            const payload = {
                ...values,
                description: values.description || null,
                contact_id: values.contact_id === "none" ? null : values.contact_id,
                account_id: values.account_id === "none" ? null : values.account_id,
            }

            const response = await fetch(ticket ? `/api/tickets/${ticket.id}` : "/api/tickets", {
                method: ticket ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await response.json()

            if (!response.ok || !json.success) {
                throw new Error(json.error || "No se pudo guardar el ticket")
            }

            toast.success(ticket ? "Ticket actualizado" : "Ticket creado")
            onSuccess()
            onOpenChange(false)
        } catch (error: any) {
            toast.error(error.message || "Error al guardar ticket")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px]">
                <DialogHeader>
                    <DialogTitle>
                        {readOnly ? "Detalle del ticket" : ticket ? "Editar ticket" : "Nuevo ticket"}
                    </DialogTitle>
                    <DialogDescription>
                        {readOnly
                            ? "Consulta el estado, prioridad y referencias del caso."
                            : "Registra un caso de soporte con referencias validadas por organizacion."}
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Titulo</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Ej. Error al procesar pago" disabled={readOnly} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prioridad</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona prioridad" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="low">Baja</SelectItem>
                                                <SelectItem value="medium">Media</SelectItem>
                                                <SelectItem value="high">Alta</SelectItem>
                                                <SelectItem value="urgent">Urgente</SelectItem>
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
                                        <FormLabel>Estado</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona estado" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="open">Abierto</SelectItem>
                                                <SelectItem value="in_progress">En progreso</SelectItem>
                                                <SelectItem value="waiting">En espera</SelectItem>
                                                <SelectItem value="resolved">Resuelto</SelectItem>
                                                <SelectItem value="closed">Cerrado</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="contact_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Contacto</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Sin contacto" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Sin contacto</SelectItem>
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
                            <FormField
                                control={form.control}
                                name="account_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cuenta</FormLabel>
                                        <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Sin cuenta" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">Sin cuenta</SelectItem>
                                                {accounts.map((account) => (
                                                    <SelectItem key={account.id} value={account.id}>
                                                        {account.name}
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
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descripcion</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Detalle del caso..." disabled={readOnly} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                {readOnly ? "Cerrar" : "Cancelar"}
                            </Button>
                            {!readOnly && (
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Guardando..." : "Guardar ticket"}
                                </Button>
                            )}
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
