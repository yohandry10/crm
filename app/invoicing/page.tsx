"use client"

import { useState, useEffect } from "react"
import { Plus, Search, FileText, Eye, Download, Send, CheckCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import DashboardLayout from "@/components/layout/dashboard-layout"
import { useToast } from "@/hooks/use-toast"
import { TutorialButton } from "@/components/tutorials"
import { ExportButton } from "@/components/data/export-button"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { invoicesExportColumns, exportToCSV } from "@/lib/export-utils"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { formatDatePE } from "@/lib/date-utils"

interface Invoice {
    id: string
    invoice_number: string
    contact_id: string
    contact?: {
        name: string
        email: string
    }
    status: "draft" | "sent" | "paid" | "overdue" | "cancelled"
    issue_date: string
    due_date: string
    subtotal: number
    tax: number
    total: number
    created_at: string
}

export default function InvoicingPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState<string>("all")
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const { toast } = useToast()

    // Bulk selection
    const {
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
    } = useBulkSelection<Invoice>()

    useEffect(() => {
        fetchInvoices()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusFilter, page, limit])

    const fetchInvoices = async () => {
        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (statusFilter && statusFilter !== 'all') {
                params.append('status', statusFilter)
            }
            params.append('page', page.toString())
            params.append('limit', limit.toString())

            const response = await fetch(`/api/invoices?${params}`)

            // ✅ FIX ERROR-UI-003: Proper network error handling
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`)
            }

            const data = await response.json()

            if (data.success) {
                setInvoices(data.data || [])
                if (data.pagination) {
                    setTotal(data.pagination.total)
                    setTotalPages(data.pagination.totalPages)
                }
            } else {
                throw new Error(data.error || "Failed to load invoices")
            }
        } catch (error: any) {
            console.error("Error fetching invoices:", error)
            toast({
                variant: "destructive",
                title: "Error al cargar facturas",
                description: error.message || "No se pudo conectar con el servidor. Intenta nuevamente."
            })
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; label: string }> = {
            draft: { variant: "secondary", label: "Borrador" },
            sent: { variant: "default", label: "Enviada" },
            paid: { variant: "success", label: "Pagada" },
            overdue: { variant: "destructive", label: "Vencida" },
            cancelled: { variant: "outline", label: "Cancelada" }
        }

        const config = variants[status] || variants.draft
        return <Badge variant={config.variant as any}>{config.label}</Badge>
    }

    const filteredInvoices = invoices.filter((invoice) => {
        const matchesSearch = invoice.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.contact?.name?.toLowerCase().includes(searchQuery.toLowerCase())

        const matchesStatus = statusFilter === "all" || invoice.status === statusFilter

        return matchesSearch && matchesStatus
    })

    const stats = {
        total: invoices.length,
        draft: invoices.filter(i => i.status === "draft").length,
        sent: invoices.filter(i => i.status === "sent").length,
        paid: invoices.filter(i => i.status === "paid").length,
        overdue: invoices.filter(i => i.status === "overdue").length,
        totalAmount: invoices.reduce((sum, inv) => sum + (inv.total || 0), 0)
    }

    // Bulk actions
    const handleBulkDelete = async (ids: string[]) => {
        const res = await fetch("/api/invoices/bulk", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        if (data.deleted === 0) {
            toast({ title: "Solo se pueden eliminar facturas en borrador" })
        } else {
            toast({ title: `Se eliminaron ${data.deleted} facturas` })
        }
        fetchInvoices()
    }

    const handleBulkStatusChange = async (ids: string[], status: string) => {
        const res = await fetch("/api/invoices/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, updates: { status } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast({ title: `Se actualizaron ${data.updated} facturas` })
        fetchInvoices()
    }

    const handleBulkExport = async (ids: string[]) => {
        const selectedInvoices = invoices.filter(i => ids.includes(i.id))
        exportToCSV(selectedInvoices, invoicesExportColumns, "facturas_seleccionadas")
        toast({ title: `Se exportaron ${selectedInvoices.length} facturas` })
    }

    const bulkActions = [
        {
            id: "export",
            label: "Exportar",
            icon: Download,
            action: handleBulkExport,
        },
        {
            id: "send",
            label: "Enviar",
            icon: Send,
            action: (ids: string[]) => handleBulkStatusChange(ids, "sent"),
        },
        {
            id: "paid",
            label: "Marcar Pagada",
            icon: CheckCircle,
            action: (ids: string[]) => handleBulkStatusChange(ids, "paid"),
        },
        {
            id: "delete",
            label: "Eliminar",
            icon: Trash2,
            variant: "destructive" as const,
            requireConfirm: true,
            confirmTitle: "¿Eliminar facturas?",
            confirmDescription: "Solo se eliminarán las facturas en borrador. Las facturas enviadas o pagadas no se pueden eliminar.",
            action: handleBulkDelete,
        },
    ]

    const allSelected = filteredInvoices.length > 0 && filteredInvoices.every(i => isSelected(i.id))
    const someSelected = filteredInvoices.some(i => isSelected(i.id)) && !allSelected

    return (
        <DashboardLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Facturación</h1>
                        <p className="text-muted-foreground">
                            Gestiona tus facturas y comprobantes
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="invoices" />
                        <ExportButton
                            data={invoices}
                            columns={invoicesExportColumns}
                            filename="facturas"
                        />
                        <Link href="/invoicing/new">
                            <Button className="gradient-neon border-0">
                                <Plus className="mr-2 h-4 w-4" />
                                Nueva Factura
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Facturas</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.total}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Borradores</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.draft}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Enviadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.sent}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pagadas</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stats.paid}</div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Monto Total</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                S/ {stats.totalAmount.toFixed(2)}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar por número o cliente..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full md:w-[200px]">
                                    <SelectValue placeholder="Estado" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los estados</SelectItem>
                                    <SelectItem value="draft">Borrador</SelectItem>
                                    <SelectItem value="sent">Enviada</SelectItem>
                                    <SelectItem value="paid">Pagada</SelectItem>
                                    <SelectItem value="overdue">Vencida</SelectItem>
                                    <SelectItem value="cancelled">Cancelada</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Invoices Table */}
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">
                                        <Checkbox
                                            checked={allSelected}
                                            ref={(el) => {
                                                if (el) (el as any).indeterminate = someSelected
                                            }}
                                            onCheckedChange={(checked) => {
                                                if (checked) selectAll(filteredInvoices)
                                                else clearSelection()
                                            }}
                                            aria-label="Seleccionar todos"
                                        />
                                    </TableHead>
                                    <TableHead>Número</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fecha Emisión</TableHead>
                                    <TableHead>Vencimiento</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8">
                                            Cargando...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8">
                                            No se encontraron facturas
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredInvoices.map((invoice) => (
                                        <TableRow
                                            key={invoice.id}
                                            className={isSelected(invoice.id) ? "bg-primary/5" : ""}
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={isSelected(invoice.id)}
                                                    onCheckedChange={() => toggleSelection(invoice.id)}
                                                    aria-label={`Seleccionar ${invoice.invoice_number}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {invoice.invoice_number}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium">
                                                        {invoice.contact?.name || "N/A"}
                                                    </div>
                                                    <div className="text-sm text-muted-foreground">
                                                        {invoice.contact?.email}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {formatDatePE(invoice.issue_date)}
                                            </TableCell>
                                            <TableCell>
                                                {formatDatePE(invoice.due_date)}
                                            </TableCell>
                                            <TableCell>
                                                {getStatusBadge(invoice.status)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                S/ {invoice.total?.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link href={`/invoicing/${invoice.id}`}>
                                                        <Button variant="ghost" size="sm">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>
                                                    <Button variant="ghost" size="sm">
                                                        <Download className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>

                        {!loading && invoices.length > 0 && (
                            <div className="p-4">
                                <PaginationControls
                                    currentPage={page}
                                    totalPages={totalPages}
                                    onPageChange={setPage}
                                    limit={limit}
                                    onLimitChange={setLimit}
                                    totalItems={total}
                                />
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Bulk Actions Bar */}
                <BulkActionsBar
                    selectedIds={selectedIds}
                    onClearSelection={clearSelection}
                    actions={bulkActions}
                    entityName="facturas"
                />
            </div>
        </DashboardLayout>
    )
}
