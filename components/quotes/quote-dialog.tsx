"use client"

import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
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
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Trash2, Check, ChevronsUpDown } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

const itemSchema = z.object({
    product_id: z.string().optional().nullable(),
    description: z.string().min(1, "Descripción requerida"),
    quantity: z.coerce.number().min(1, "Mínimo 1"),
    unit_price: z.coerce.number().min(0, "Precio requerido"),
})

const formSchema = z.object({
    contact_id: z.string().min(1, "Contacto requerido"),
    opportunity_id: z.string().optional(),
    valid_until: z.string().optional(),
    notes: z.string().optional(),
    terms: z.string().optional(),
    items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
})

interface QuoteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    quote?: any
    onSuccess: () => void
}

export function QuoteDialog({
    open,
    onOpenChange,
    quote,
    onSuccess
}: QuoteDialogProps) {
    const [contacts, setContacts] = useState<any[]>([])
    const [opportunities, setOpportunities] = useState<any[]>([])
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            contact_id: "",
            opportunity_id: "none",
            valid_until: "",
            notes: "",
            terms: "",
            items: [{ product_id: null, description: "", quantity: 1, unit_price: 0 }],
        },
    })

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "items",
    })

    const watchItems = form.watch("items")
    const totalAmount = watchItems.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unit_price)), 0)

    useEffect(() => {
        const loadData = async () => {
            const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser')
            const supabase = getSupabaseBrowserClient()

            const [contactsRes, oppsRes] = await Promise.all([
                supabase.from('contacts').select('id, name').order('name'),
                supabase.from('opportunities').select('id, name').eq('status', 'open').order('name')
            ])
            
            if (contactsRes.data) setContacts(contactsRes.data)
            if (oppsRes.data) setOpportunities(oppsRes.data)

            const { data: productsData } = await supabase
                .from('products')
                .select('id, name, sku, unit_price, is_service')
                .eq('is_active', true)
                .order('name')
            if (productsData) setProducts(productsData)
        }
        
        loadData().catch(console.error)
        if (quote) {
            // Fetch items if editing (not implemented fully in this snippet for brevity, assuming new quote mostly)
            form.reset({
                contact_id: quote.contact_id,
                opportunity_id: quote.opportunity_id || "none",
                valid_until: quote.valid_until || "",
                notes: quote.notes || "",
                terms: quote.terms || "",
                items: quote.items?.map((i: any) => ({
                    product_id: i.product_id || null,
                    description: i.description,
                    quantity: i.quantity,
                    unit_price: i.unit_price
                })) || [{ description: "", quantity: 1, unit_price: 0 }]
            })
        } else {
            form.reset({
                contact_id: "",
                opportunity_id: "none",
                valid_until: "",
                notes: "",
                terms: "",
                items: [{ product_id: null, description: "", quantity: 1, unit_price: 0 }],
            })
        }
    }, [open, quote, form])

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        setLoading(true)
        try {
            const payload = {
                ...values,
                opportunity_id: values.opportunity_id === "none" ? null : values.opportunity_id,
                items: values.items.map((item) => ({
                    ...item,
                    product_id: item.product_id ? item.product_id : null,
                })),
            }

            const response = await fetch(
                quote ? `/api/quotes/${quote.id}` : '/api/quotes',
                {
                    method: quote ? 'PATCH' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                }
            )

            if (!response.ok) throw new Error('Failed to save quote')

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
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>
                        {quote ? "Editar Cotización" : "Nueva Cotización"}
                    </DialogTitle>
                    <DialogDescription>
                        Crea una cotización formal para tus clientes.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="contact_id"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Cliente</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecciona cliente" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
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
                                        <FormLabel>Oportunidad (Opcional)</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Relacionar con oportunidad" />
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

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <FormLabel>Ítems de la Cotización</FormLabel>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => append({ product_id: null, description: "", quantity: 1, unit_price: 0 })}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Agregar Ítem
                                </Button>
                            </div>

                            <div className="space-y-2 max-h-[200px] overflow-y-auto p-1">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-end">
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.product_id`}
                                            render={({ field }) => {
                                                const selected = products.find((p) => p.id === field.value)
                                                return (
                                                    <FormItem className="w-44">
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                                                    {selected ? selected.name : "Producto..."}
                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[320px] p-0">
                                                                <Command>
                                                                    <CommandInput placeholder="Buscar producto..." />
                                                                    <CommandList>
                                                                        <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            <CommandItem
                                                                                value="item-libre"
                                                                                onSelect={() => {
                                                                                    form.setValue(`items.${index}.product_id`, null, { shouldValidate: true })
                                                                                }}
                                                                            >
                                                                                <Check className={cn("mr-2 h-4 w-4", !field.value ? "opacity-100" : "opacity-0")} />
                                                                                Item libre
                                                                            </CommandItem>
                                                                            {products.map((product) => (
                                                                                <CommandItem
                                                                                    key={product.id}
                                                                                    value={`${product.name} ${product.sku || ""}`}
                                                                                    onSelect={() => {
                                                                                        form.setValue(`items.${index}.product_id`, product.id, { shouldValidate: true })
                                                                                        form.setValue(`items.${index}.description`, product.name, { shouldValidate: true })
                                                                                        form.setValue(`items.${index}.unit_price`, Number(product.unit_price || 0), { shouldValidate: true })
                                                                                    }}
                                                                                >
                                                                                    <Check className={cn("mr-2 h-4 w-4", field.value === product.id ? "opacity-100" : "opacity-0")} />
                                                                                    {product.name}{product.sku ? ` (${product.sku})` : ""}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </FormItem>
                                                )
                                            }}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.description`}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder="Descripción" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.quantity`}
                                            render={({ field }) => (
                                                <FormItem className="w-20">
                                                    <FormControl>
                                                        <Input type="number" placeholder="Cant." {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`items.${index}.unit_price`}
                                            render={({ field }) => (
                                                <FormItem className="w-24">
                                                    <FormControl>
                                                        <Input type="number" placeholder="Precio" {...field} />
                                                    </FormControl>
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
                            </div>
                            <div className="text-right font-bold text-lg">
                                Total: {formatCurrency(totalAmount)}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="valid_until"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Válido Hasta</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notas</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Notas visibles para el cliente..." {...field} />
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
                                {loading ? "Guardando..." : "Crear Cotización"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
