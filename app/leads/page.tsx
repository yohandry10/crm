"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { LeadDialog } from "@/components/leads/lead-dialog"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, RefreshCw, Download, Tag, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { contactsExportColumns, exportToCSV } from "@/lib/export-utils"
import { ConvertLeadDialog } from "@/components/leads/convert-lead-dialog"
import { UserCheck } from "lucide-react"

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedLead, setSelectedLead] = useState<any>(null)
    const [filter, setFilter] = useState("")
    const [convertDialogOpen, setConvertDialogOpen] = useState(false)
    const [leadToConvert, setLeadToConvert] = useState<any>(null)

    // Bulk selection
    const {
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
    } = useBulkSelection<any>()

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/contacts')
            if (!res.ok) throw new Error('Failed to fetch leads')
            const data = await res.json()
            const leadsData = data.data?.filter((c: any) => c.lead_status) || []
            setLeads(leadsData)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar leads")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchLeads()
    }, [])

    const handleAddLead = () => {
        setSelectedLead(null)
        setDialogOpen(true)
    }

    const handleEditLead = (lead: any) => {
        setSelectedLead(lead)
        setDialogOpen(true)
    }

    const handleConvertLead = (lead: any) => {
        setLeadToConvert(lead)
        setConvertDialogOpen(true)
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'cold': return 'secondary'
            case 'warm': return 'default'
            case 'hot': return 'destructive'
            case 'converted': return 'outline'
            case 'lost': return 'secondary'
            default: return 'secondary'
        }
    }

    const filteredLeads = leads.filter(lead =>
        lead.name.toLowerCase().includes(filter.toLowerCase()) ||
        lead.email.toLowerCase().includes(filter.toLowerCase())
    )

    // Bulk actions
    const handleBulkDelete = async (ids: string[]) => {
        const res = await fetch("/api/contacts/bulk", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast.success(`Se eliminaron ${data.deleted} leads`)
        fetchLeads()
    }

    const handleBulkStatusChange = async (ids: string[], status: string) => {
        const res = await fetch("/api/contacts/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, updates: { lead_status: status } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast.success(`Se actualizaron ${data.updated} leads`)
        fetchLeads()
    }

    const handleBulkExport = async (ids: string[]) => {
        const selectedLeads = leads.filter(l => ids.includes(l.id))
        exportToCSV(selectedLeads, contactsExportColumns, "leads_seleccionados")
        toast.success(`Se exportaron ${selectedLeads.length} leads`)
    }

    const bulkActions = [
        {
            id: "export",
            label: "Exportar",
            icon: Download,
            action: handleBulkExport,
        },
        {
            id: "warm",
            label: "Tibio",
            icon: Tag,
            action: (ids: string[]) => handleBulkStatusChange(ids, "warm"),
        },
        {
            id: "hot",
            label: "Caliente",
            icon: Tag,
            action: (ids: string[]) => handleBulkStatusChange(ids, "hot"),
        },
        {
            id: "converted",
            label: "Convertido",
            icon: Tag,
            action: (ids: string[]) => handleBulkStatusChange(ids, "converted"),
        },
        {
            id: "delete",
            label: "Eliminar",
            icon: Trash2,
            variant: "destructive" as const,
            requireConfirm: true,
            confirmTitle: "¿Eliminar leads?",
            confirmDescription: "Esta acción eliminará permanentemente los leads seleccionados.",
            action: handleBulkDelete,
        },
    ]

    const allSelected = filteredLeads.length > 0 && filteredLeads.every(l => isSelected(l.id))
    const someSelected = filteredLeads.some(l => isSelected(l.id)) && !allSelected

    return (
        <DashboardLayout>
            <div className="flex flex-col h-[calc(100vh-4rem)]">
                <div className="flex items-center justify-between pb-6 border-b">
                    <div className="space-y-1">
                        <h1 className="text-3xl font-bold tracking-tight">Leads</h1>
                        <p className="text-muted-foreground">
                            Gestiona y califica tus prospectos de venta
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <TutorialButton moduleId="leads" />
                        <Button variant="outline" size="icon" onClick={fetchLeads}>
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button onClick={handleAddLead} className="gradient-neon border-0">
                            <Plus className="mr-2 h-4 w-4" />
                            Nuevo Lead
                        </Button>
                    </div>
                </div>

                <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2 max-w-sm">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar leads..."
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                        />
                    </div>

                    <div className="rounded-md border">
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
                                                if (checked) selectAll(filteredLeads)
                                                else clearSelection()
                                            }}
                                            aria-label="Seleccionar todos"
                                        />
                                    </TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8">
                                            Cargando...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredLeads.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No hay leads encontrados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredLeads.map((lead) => (
                                        <TableRow
                                            key={lead.id}
                                            className={isSelected(lead.id) ? "bg-primary/5" : ""}
                                        >
                                            <TableCell>
                                                <Checkbox
                                                    checked={isSelected(lead.id)}
                                                    onCheckedChange={() => toggleSelection(lead.id)}
                                                    aria-label={`Seleccionar ${lead.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {lead.name}
                                            </TableCell>
                                            <TableCell>
                                                {lead.email}
                                            </TableCell>
                                            <TableCell>
                                                {lead.phone || '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getStatusColor(lead.lead_status) as any}>
                                                    {lead.lead_status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right space-x-1">
                                                {lead.lead_status !== "converted" && lead.lead_status !== "lost" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleConvertLead(lead)}
                                                        className="text-green-600 hover:text-green-700"
                                                    >
                                                        <UserCheck className="w-4 h-4 mr-1" />
                                                        Convertir
                                                    </Button>
                                                )}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEditLead(lead)}
                                                >
                                                    Editar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <LeadDialog
                    open={dialogOpen}
                    onOpenChange={setDialogOpen}
                    lead={selectedLead}
                    onSuccess={fetchLeads}
                />

                <ConvertLeadDialog
                    open={convertDialogOpen}
                    onOpenChange={setConvertDialogOpen}
                    lead={leadToConvert}
                    onSuccess={fetchLeads}
                />

                {/* Bulk Actions Bar */}
                <BulkActionsBar
                    selectedIds={selectedIds}
                    onClearSelection={clearSelection}
                    actions={bulkActions}
                    entityName="leads"
                />
            </div>
        </DashboardLayout>
    )
}
