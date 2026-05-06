"use client"

import { useState, useEffect } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Search, Plus, Eye } from "lucide-react"
import { OrderDialog } from "@/components/orders/order-dialog"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { Loading } from "@/components/ui/loading"
import { toast } from "sonner"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface Order {
    id: string
    order_number: string
    contact_id: string | null
    contact?: { name: string }
    opportunity_id: string | null
    status: string
    total: number
    notes: string | null
    created_at: string
}

export function OrdersTable() {
    const [orders, setOrders] = useState<Order[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [orderToDelete, setOrderToDelete] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

    useEffect(() => {
        loadOrders()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit])

    const loadOrders = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("page", page.toString())
            params.append("limit", limit.toString())

            const res = await fetch(`/api/orders?${params.toString()}`)
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

            const data = await res.json()
            if (data.success) {
                setOrders(data.data || [])
                if (data.pagination) {
                    setTotal(data.pagination.total)
                    setTotalPages(data.pagination.totalPages || Math.ceil(data.pagination.total / limit))
                }
            }
        } catch (error: any) {
            console.error("Error loading orders:", error)
            toast.error("Error al cargar pedidos")
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        loadOrders()
    }

    const handleDeleteClick = (id: string) => {
        setOrderToDelete(id)
        setDeleteDialogOpen(true)
    }

    const handleCreate = () => {
        setSelectedOrder(null)
        setDialogMode("create")
        setDialogOpen(true)
    }

    const handleView = (order: Order) => {
        setSelectedOrder(order)
        setDialogMode("view")
        setDialogOpen(true)
    }

    const handleEdit = (order: Order) => {
        setSelectedOrder(order)
        setDialogMode("edit")
        setDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!orderToDelete) return
        try {
            const res = await fetch(`/api/orders/${orderToDelete}`, { method: "DELETE" })
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
            const data = await res.json()
            if (data.success) {
                toast.success("Pedido eliminado")
                loadOrders()
            }
        } catch {
            toast.error("Error al eliminar pedido")
        } finally {
            setDeleteDialogOpen(false)
            setOrderToDelete(null)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "draft": return "bg-slate-500"
            case "confirmed": return "bg-blue-500"
            case "fulfilled": return "bg-purple-500"
            case "completed": return "bg-green-500"
            case "cancelled": return "bg-red-500"
            default: return "bg-slate-500"
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount)
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar pedidos..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                    </div>
                    <Button type="submit" variant="secondary">Buscar</Button>
                </form>
                <Button className="gradient-neon border-0" onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />Nuevo Pedido
                </Button>
            </div>

            <div className="border rounded-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8"><Loading text="Cargando pedidos..." /></TableCell></TableRow>
                        ) : orders.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron pedidos</TableCell></TableRow>
                        ) : (
                            orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.order_number}</TableCell>
                                    <TableCell>{order.contact?.name || "-"}</TableCell>
                                    <TableCell><Badge className={`${getStatusColor(order.status)} text-white border-0`}>{order.status}</Badge></TableCell>
                                    <TableCell>{formatCurrency(order.total)}</TableCell>
                                    <TableCell>{new Date(order.created_at).toLocaleDateString("es-PE")}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleView(order)}><Eye className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(order)}><Edit className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(order.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} limit={limit} onLimitChange={setLimit} totalItems={total} />

            <OrderDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                order={selectedOrder}
                mode={dialogMode}
                onSuccess={loadOrders}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
