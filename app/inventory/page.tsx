"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Search, Package, Loader2, Edit, ExternalLink } from "lucide-react"
import DashboardLayout from "@/components/layout/dashboard-layout"
import { AddItemDialog } from "@/components/inventory/add-item-dialog"
import { toast } from "sonner"

interface InventoryItem {
    id: string
    product_name: string
    sku: string
    quantity: number
    price: number
    updated_at: string
}

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)

    const fetchInventory = async () => {
        try {
            setLoading(true)
            const response = await fetch("/api/inventory")
            const result = await response.json()
            if (result.success) {
                setItems(result.data)
            } else {
                toast.error("Error al cargar inventario")
            }
        } catch (error) {
            console.error("Error fetching inventory:", error)
            toast.error("Error de conexión")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInventory()
    }, [])

    const filteredItems = items.filter((item) =>
        item.product_name.toLowerCase().includes(search.toLowerCase()) ||
        item.sku?.toLowerCase().includes(search.toLowerCase())
    )

    const handleEdit = (item: InventoryItem) => {
        setEditingItem(item)
        setIsDialogOpen(true)
    }

    const handleDialogClose = (open: boolean) => {
        setIsDialogOpen(open)
        if (!open) setEditingItem(null)
    }

    return (
        <DashboardLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Inventario</h1>
                        <p className="text-muted-foreground">
                            Gestiona el stock de tus productos físicos
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={() => window.location.assign("/products")}>
                            Ir a Productos
                            <ExternalLink className="ml-2 h-4 w-4" />
                        </Button>
                        <Button onClick={() => setIsDialogOpen(true)} className="gradient-neon border-0">
                        <Plus className="mr-2 h-4 w-4" />
                        Ajustar Stock
                    </Button>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por nombre o SKU..."
                            className="pl-8"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Producto</TableHead>
                                <TableHead>SKU</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                                <TableHead className="text-right">Precio Unit.</TableHead>
                                <TableHead className="text-right">Valor Total</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <div className="flex justify-center">
                                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : filteredItems.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                                            <Package className="h-8 w-8 mb-2" />
                                            <p>No hay productos en el inventario</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredItems.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.product_name}</TableCell>
                                        <TableCell>{item.sku || "-"}</TableCell>
                                        <TableCell className="text-right">
                                            <span className={item.quantity < 10 ? "text-red-500 font-bold" : ""}>
                                                {item.quantity}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            S/ {Number(item.price).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            S/ {(item.quantity * Number(item.price)).toFixed(2)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <AddItemDialog
                open={isDialogOpen}
                onOpenChange={handleDialogClose}
                onSuccess={fetchInventory}
                editingItem={editingItem}
            />
        </DashboardLayout>
    )
}
