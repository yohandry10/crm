"use client"

import { useState, useEffect } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Edit, Trash2, Search, Plus, Eye } from "lucide-react"
import { TicketDialog } from "@/components/tickets/ticket-dialog"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { Loading } from "@/components/ui/loading"
import { toast } from "sonner"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface TicketItem {
    id: string
    title: string
    description: string | null
    contact_id: string | null
    contact?: { name: string }
    priority: string
    status: string
    assigned_to: string | null
    created_at: string
}

export function TicketsTable() {
    const [tickets, setTickets] = useState<TicketItem[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [ticketToDelete, setTicketToDelete] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view">("create")
    const [selectedTicket, setSelectedTicket] = useState<TicketItem | null>(null)

    useEffect(() => {
        loadTickets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit])

    const loadTickets = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("page", page.toString())
            params.append("limit", limit.toString())

            const res = await fetch(`/api/tickets?${params.toString()}`)
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

            const data = await res.json()
            if (data.success) {
                setTickets(data.data || [])
                if (data.pagination) {
                    setTotal(data.pagination.total)
                    setTotalPages(data.pagination.totalPages || Math.ceil(data.pagination.total / limit))
                }
            }
        } catch (error: any) {
            console.error("Error loading tickets:", error)
            toast.error("Error al cargar tickets")
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        loadTickets()
    }

    const handleDeleteClick = (id: string) => {
        setTicketToDelete(id)
        setDeleteDialogOpen(true)
    }

    const handleCreate = () => {
        setSelectedTicket(null)
        setDialogMode("create")
        setDialogOpen(true)
    }

    const handleView = (ticket: TicketItem) => {
        setSelectedTicket(ticket)
        setDialogMode("view")
        setDialogOpen(true)
    }

    const handleEdit = (ticket: TicketItem) => {
        setSelectedTicket(ticket)
        setDialogMode("edit")
        setDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!ticketToDelete) return
        try {
            const res = await fetch(`/api/tickets/${ticketToDelete}`, { method: "DELETE" })
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
            const data = await res.json()
            if (data.success) {
                toast.success("Ticket eliminado")
                loadTickets()
            }
        } catch {
            toast.error("Error al eliminar ticket")
        } finally {
            setDeleteDialogOpen(false)
            setTicketToDelete(null)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "open": return "bg-blue-500"
            case "in_progress": return "bg-yellow-500"
            case "resolved": return "bg-green-500"
            case "closed": return "bg-slate-500"
            default: return "bg-slate-500"
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case "urgent": return "bg-red-500"
            case "high": return "bg-orange-500"
            case "medium": return "bg-yellow-500"
            case "low": return "bg-green-500"
            default: return "bg-slate-500"
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar tickets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                    </div>
                    <Button type="submit" variant="secondary">Buscar</Button>
                </form>
                <Button className="gradient-neon border-0" onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />Nuevo Ticket
                </Button>
            </div>

            <div className="border rounded-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>N° Ticket</TableHead>
                            <TableHead>Asunto</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Prioridad</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8"><Loading text="Cargando tickets..." /></TableCell></TableRow>
                        ) : tickets.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No se encontraron tickets</TableCell></TableRow>
                        ) : (
                            tickets.map((ticket) => (
                                <TableRow key={ticket.id}>
                                    <TableCell className="font-medium">{ticket.id.slice(0, 8)}</TableCell>
                                    <TableCell>{ticket.title}</TableCell>
                                    <TableCell>{ticket.contact?.name || "-"}</TableCell>
                                    <TableCell><Badge className={`${getPriorityColor(ticket.priority)} text-white border-0`}>{ticket.priority}</Badge></TableCell>
                                    <TableCell><Badge className={`${getStatusColor(ticket.status)} text-white border-0`}>{ticket.status}</Badge></TableCell>
                                    <TableCell>{new Date(ticket.created_at).toLocaleDateString("es-PE")}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleView(ticket)}><Eye className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(ticket)}><Edit className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(ticket.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} limit={limit} onLimitChange={setLimit} totalItems={total} />

            <TicketDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                ticket={selectedTicket}
                mode={dialogMode}
                onSuccess={loadTickets}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar ticket?</AlertDialogTitle>
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
