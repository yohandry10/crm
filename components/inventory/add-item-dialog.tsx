"use client"

import { useEffect, useMemo, useState } from "react"
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
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Check, ChevronsUpDown } from "lucide-react"

interface InventoryItem {
    id: string
    product_name: string
    sku: string
    quantity: number
    price: number
}

type ProductOption = {
    id: string
    name: string
    sku: string | null
    unit_price: number
    stock_quantity: number
}

interface AddItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    editingItem?: InventoryItem | null
}

export function AddItemDialog({ open, onOpenChange, onSuccess, editingItem }: AddItemDialogProps) {
    const [products, setProducts] = useState<ProductOption[]>([])
    const [productsLoaded, setProductsLoaded] = useState(false)

    const itemSchema = z.object({
        product_id: z.string().min(1, "Selecciona un producto"),
        quantity: z.preprocess(
            (v) => (v === "" || v === null || v === undefined ? 0 : v),
            z.coerce.number().int().min(0, "Cantidad no puede ser negativa")
        ),
    })

    type ItemFormData = z.infer<typeof itemSchema>

    const form = useForm<ItemFormData>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            product_id: "",
            quantity: 0,
        },
        mode: "onChange",
    })

    const { handleSubmit, reset, formState: { isSubmitting } } = form

    const selectedProductId = form.watch("product_id")

    const selectedProduct = useMemo(() => {
        return products.find((p) => p.id === selectedProductId)
    }, [products, selectedProductId])

    useEffect(() => {
        if (!open || productsLoaded) return

        const loadProducts = async () => {
            try {
                const res = await fetch("/api/products?is_service=false&limit=500")
                const json = await res.json()
                if (json?.success && Array.isArray(json.data)) {
                    setProducts(json.data)
                }
            } catch (e) {
                console.error("Failed to load products for inventory", e)
            } finally {
                setProductsLoaded(true)
            }
        }

        loadProducts()
    }, [open, productsLoaded])

    useEffect(() => {
        if (!open) return
        if (editingItem) {
            reset({
                product_id: editingItem.id,
                quantity: editingItem.quantity,
            })
        } else {
            reset({ product_id: "", quantity: 0 })
        }
    }, [editingItem, open, reset])

    const onSubmit = async (data: ItemFormData) => {
        try {
            const url = `/api/inventory/${data.product_id}`
            const method = "PUT"

            const payload = {
                quantity: data.quantity,
            }
            
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const result = await response.json()

            if (result.success) {
                toast.success("Stock actualizado")
                onOpenChange(false)
                reset({ product_id: "", quantity: 0 })
                onSuccess()
            } else {
                toast.error(result.error || "Error al guardar producto")
            }
        } catch (error) {
            console.error("Error saving item:", error)
            toast.error("Error de conexión")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingItem ? "Ajustar Stock" : "Agregar al Inventario"}</DialogTitle>
                    <DialogDescription>
                        Selecciona un producto del catálogo y define el stock disponible.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid gap-4 py-2">
                            <FormField
                                control={form.control}
                                name="product_id"
                                render={({ field }) => (
                                    <FormItem className="space-y-2">
                                        <FormLabel>Producto</FormLabel>
                                        <input type="hidden" {...field} />
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className="w-full justify-between">
                                                    {selectedProduct ? `${selectedProduct.name}${selectedProduct.sku ? ` (${selectedProduct.sku})` : ""}` : "Buscar producto..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-full p-0">
                                                <Command>
                                                    <CommandInput placeholder="Buscar producto..." />
                                                    <CommandList>
                                                        <CommandEmpty>No se encontraron productos.</CommandEmpty>
                                                        <CommandGroup>
                                                            {products.map((product) => (
                                                                <CommandItem
                                                                    key={product.id}
                                                                    value={`${product.name} ${product.sku || ""}`}
                                                                    onSelect={() => {
                                                                        form.setValue("product_id", product.id, { shouldValidate: true })
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedProductId === product.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    {product.name}{product.sku ? ` (${product.sku})` : ""}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="quantity"
                                render={({ field }) => (
                                    <FormItem className="grid grid-cols-4 items-center gap-4">
                                        <FormLabel className="text-right">Stock</FormLabel>
                                        <div className="col-span-3 space-y-1">
                                            <FormControl>
                                                <Input type="number" min="0" inputMode="numeric" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </div>
                                    </FormItem>
                                )}
                            />

                            {selectedProduct && (
                                <div className="text-sm text-muted-foreground">
                                    Precio venta actual: S/ {Number(selectedProduct.unit_price || 0).toFixed(2)}. Edita precio desde el módulo Productos.
                                </div>
                            )}
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={isSubmitting || !selectedProductId}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}
