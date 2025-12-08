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
import { Textarea } from "@/components/ui/textarea"
// ✅ FIX TASK-002/003: Sincronizar con schema del backend
const formSchema = z.object({
    title: z.string().min(2, "El título es requerido"),
    description: z.string().optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
    due_date: z.string().optional(),
    contact_id: z.string().optional(),
})

interface TaskDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    task?: any
    onSuccess: () => void
}

export function TaskDialog({
    open,
    onOpenChange,
    task,
    onSuccess
}: TaskDialogProps) {
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: "",
            description: "",
            priority: "medium",
            status: "pending",
            due_date: "",
            contact_id: "none",
        },
    })

    useEffect(() => {
        const loadContacts = async () => {
            // ✅ FIX TASK-001: Cargar contactos via API para respetar multi-tenant
            try {
                const res = await fetch('/api/contacts?limit=100')
                const data = await res.json()
                if (data.success && data.data) {
                    setContacts(data.data)
                }
            } catch (error) {
                console.error('Error loading contacts:', error)
            }
        }
        loadContacts()

        if (task) {
            form.reset({
                title: task.title,
                description: task.description || "",
                priority: task.priority,
                status: task.status,
                due_date: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : "",
                contact_id: task.contact_id || "none",
            })
        } else {
            form.reset({
                title: "",
                description: "",
                priority: "medium",
                status: "pending",
                due_date: "",
                contact_id: "none",
            })
        }
    }, [open, task, form])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const payload = {
                ...values,
                contact_id: values.contact_id === "none" ? null : values.contact_id
            }

            const response = await fetch(
                task ? `/api/tasks/${task.id}` : '/api/tasks',
                {
                    method: task ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )

            if (!response.ok) throw new Error('Failed to save task')

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
                        {task ? "Editar Tarea" : "Nueva Tarea"}
                    </DialogTitle>
                    <DialogDescription>
                        {task ? "Modifica los detalles de la tarea." : "Crea una nueva tarea para seguimiento."}
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
                                        <Input placeholder="Ej. Llamar a cliente" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="priority"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Prioridad</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona" />
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
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="pending">Pendiente</SelectItem>
                                                <SelectItem value="in_progress">En Progreso</SelectItem>
                                                <SelectItem value="completed">Completada</SelectItem>
                                                <SelectItem value="cancelled">Cancelada</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="contact_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Contacto Relacionado</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecciona contacto (opcional)" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="none">Ninguno</SelectItem>
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
                            name="due_date"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Fecha de Vencimiento</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
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
                                        <Textarea placeholder="Detalles adicionales..." {...field} />
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
                                {loading ? "Guardando..." : "Guardar Tarea"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
