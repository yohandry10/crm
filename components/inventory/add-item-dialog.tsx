"use client"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface InventoryItem {
    id: string
    product_name: string
    sku: string
    quantity: number
    price: number
}

interface AddItemDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess: () => void
    editingItem?: InventoryItem | null
}

export function AddItemDialog({ open, onOpenChange, onSuccess, editingItem }: AddItemDialogProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        product_name: "",
        sku: "",
        quantity: 0,
        price: 0,
    })

    useEffect(() => {
        if (editingItem) {
            setFormData({
                product_name: editingItem.product_name,
                sku: editingItem.sku || "",
                quantity: editingItem.quantity,
                price: editingItem.price,
            })
        } else {
            setFormData({ product_name: "", sku: "", quantity: 0, price: 0 })
        }
    }, [editingItem, open])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const url = editingItem ? `/api/inventory/${editingItem.id}` : "/api/inventory"
            const method = editingItem ? "PUT" : "POST"
            
            const response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            const result = await response.json()

            if (result.success) {
                toast.success(editingItem ? "Producto actualizado" : "Producto agregado exitosamente")
                onOpenChange(false)
                setFormData({ product_name: "", sku: "", quantity: 0, price: 0 })
                onSuccess()
            } else {
                toast.error(result.error || "Error al guardar producto")
            }
        } catch (error) {
            console.error("Error saving item:", error)
            toast.error("Error de conexión")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{editingItem ? "Editar Producto" : "Agregar Producto"}</DialogTitle>
                    <DialogDescription>
                        {editingItem ? "Modifica los detalles del producto." : "Ingresa los detalles del nuevo producto para el inventario."}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                                Nombre
                            </Label>
                            <Input
                                id="name"
                                value={formData.product_name}
                                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="sku" className="text-right">
                                SKU
                            </Label>
                            <Input
                                id="sku"
                                value={formData.sku}
                                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="quantity" className="text-right">
                                Cantidad
                            </Label>
                            <Input
                                id="quantity"
                                type="number"
                                min="0"
                                value={formData.quantity}
                                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                                className="col-span-3"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="price" className="text-right">
                                Precio
                            </Label>
                            <Input
                                id="price"
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                className="col-span-3"
                                required
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingItem ? "Actualizar" : "Guardar"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
