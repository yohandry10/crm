"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

const itemSchema = z.object({
    description: z.string().min(1, "Descripción requerida"),
    quantity: z.coerce.number().min(1, "Mínimo 1"),
    unit_price: z.coerce.number().min(0, "Precio requerido"),
})

const formSchema = z.object({
    contact_id: z.string().min(1, "Cliente requerido"),
    due_date: z.string().min(1, "Fecha de vencimiento requerida"),
    notes: z.string().optional(),
    items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
})

export default function NewInvoicePage() {
    const router = useRouter()
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [loadingContacts, setLoadingContacts] = useState(true)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            contact_id: "",
            due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            notes: "",
            items: [{ description: "", quantity: 1, unit_price: 0 }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const watchItems = form.watch("items")
    const subtotal = watchItems.reduce((sum, item) => 
        sum + (Number(item.quantity) * Number(item.unit_price)), 0
    )
    const tax = subtotal * 0.18
    const total = subtotal + tax

    useEffect(() => {
        const loadContacts = async () => {
            try {
                const res = await fetch('/api/contacts?limit=100')
                const data = await res.json()
                if (data.success) {
                    setContacts(data.data || [])
                }
            } catch (error) {
                console.error(error)
            } finally {
                setLoadingContacts(false)
            }
        }
        loadContacts()
    }, [])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const res = await fetch('/api/invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            })

            const data = await res.json()

            if (!res.ok || !data.success) {
                throw new Error(data.error || 'Error al crear factura')
            }

            toast.success(`Factura ${data.data.invoice_number} creada exitosamente`)
            router.push('/invoicing')
        } catch (error: any) {
            toast.error(error.message || 'Error al crear factura')
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('es-PE', { 
            style: 'currency', 
            currency: 'PEN' 
        }).format(amount)
    }

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="flex items-center gap-4 mb-6">
                    <Link href="/invoicing">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold">Nueva Factura</h1>
                        <p className="text-muted-foreground">Crea una nueva factura para tu cliente</p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Información del Cliente</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="contact_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cliente</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder={loadingContacts ? "Cargando..." : "Selecciona cliente"} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {contacts.map((c) => (
                                                        <SelectItem key={c.id} value={c.id}>
                                                            {c.name} {c.ruc ? `(${c.ruc})` : ''}
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
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Ítems</CardTitle>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ description: "", quantity: 1, unit_price: 0 })}
                                >
                                    <Plus className="h-4 w-4 mr-1" /> Agregar
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-4 items-end">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.description`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className={index > 0 ? "sr-only" : ""}>Descripción</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Descripción del producto/servicio" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem className="w-24">
                                                    <FormLabel className={index > 0 ? "sr-only" : ""}>Cantidad</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="1" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.unit_price`}
                                            render={({ field }) => (
                                                <FormItem className="w-32">
                                                    <FormLabel className={index > 0 ? "sr-only" : ""}>Precio Unit.</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" min="0" step="0.01" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => remove(index)}
                                            disabled={fields.length === 1}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </div>
                                ))}

                                <div className="border-t pt-4 space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span>Subtotal:</span>
                                        <span>{formatCurrency(subtotal)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span>IGV (18%):</span>
                                        <span>{formatCurrency(tax)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>Total:</span>
                                        <span>{formatCurrency(total)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Notas</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FormField
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Textarea 
                                                    placeholder="Notas adicionales para el cliente..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                        <div className="flex justify-end gap-4">
                            <Link href="/invoicing">
                                <Button type="button" variant="outline">Cancelar</Button>
                            </Link>
                            <Button type="submit" disabled={loading}>
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Creando...
                                    </>
                                ) : (
                                    'Crear Factura'
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </DashboardLayout>
    )
}
