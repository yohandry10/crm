"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, Search, Plus, Phone, Mail, Upload, Tag, Download } from "lucide-react"
import { LeadScoreBadge } from "./lead-score-badge"
import { WhatsAppButton } from "./whatsapp-button"
import { ContactDialog } from "./contact-dialog"
import { ExportButton } from "@/components/data/export-button"
import { ImportModal } from "@/components/data/import-modal"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { contactsExportColumns, exportToCSV } from "@/lib/export-utils"
import { contactsImportColumns } from "@/lib/import-utils"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { Loading } from "@/components/ui/loading"
import { useToast } from "@/hooks/use-toast"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export function ContactsTable() {
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedContact, setSelectedContact] = useState<any>(null)

    // Pagination state
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [contactToDelete, setContactToDelete] = useState<string | null>(null)
    const [importModalOpen, setImportModalOpen] = useState(false)
    const { toast } = useToast()

    // Bulk selection
    const {
        selectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        isSelected,
    } = useBulkSelection<any>()

    useEffect(() => {
        loadContacts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit]) // Reload when page or limit changes

    const loadContacts = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("page", page.toString())
            params.append("limit", limit.toString())

            const res = await fetch(`/api/contacts?${params.toString()}`)

            // ✅ FIX ERROR-UI-001: Proper network error handling
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`)
            }

            const data = await res.json()
            if (data.success) {
                setContacts(data.data)
                if (data.pagination) {
                    setTotal(data.pagination.total)
                    setTotalPages(data.pagination.totalPages || Math.ceil(data.pagination.total / limit))
                }
            } else {
                throw new Error(data.error || "Failed to load contacts")
            }
        } catch (error: any) {
            console.error("Error loading contacts:", error)
            toast({
                variant: "destructive",
                title: "Error al cargar contactos",
                description: error.message || "No se pudieron cargar los contactos. Intenta nuevamente."
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1) // Reset to first page on search
        loadContacts()
    }

    const handleCreate = useCallback(() => {
        setSelectedContact(null)
        setDialogOpen(true)
    }, [])

    const handleEdit = useCallback((contact: any) => {
        setSelectedContact(contact)
        setDialogOpen(true)
    }, [])

    // ✅ FIX ERROR-UI-002: Use ConfirmDialog instead of native confirm()
    const handleDeleteClick = useCallback((id: string) => {
        setContactToDelete(id)
        setDeleteDialogOpen(true)
    }, [])

    const handleDelete = async () => {
        if (!contactToDelete) return

        try {
            const res = await fetch(`/api/contacts/${contactToDelete}`, { method: "DELETE" })

            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`)
            }

            const data = await res.json()
            if (data.success) {
                toast({
                    title: "Contacto eliminado",
                    description: "El contacto se eliminó correctamente."
                })
                loadContacts()
            } else {
                throw new Error(data.error || "Failed to delete contact")
            }
        } catch (error: any) {
            console.error("Error deleting contact:", error)
            toast({
                variant: "destructive",
                title: "Error al eliminar",
                description: error.message || "No se pudo eliminar el contacto. Intenta nuevamente."
            })
        } finally {
            setDeleteDialogOpen(false)
            setContactToDelete(null)
        }
    }

    const handleSave = async (contactData: any) => {
        try {
            const url = selectedContact
                ? `/api/contacts/${selectedContact.id}`
                : "/api/contacts"

            const method = selectedContact ? "PUT" : "POST"

            console.log("=== FRONTEND: handleSave ===")
            console.log("URL:", url)
            console.log("Method:", method)
            console.log("Data:", JSON.stringify(contactData))

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(contactData)
            })

            console.log("Response status:", res.status)

            // Leer la respuesta como texto primero para debug
            const responseText = await res.text()
            console.log("Response body:", responseText)

            // Parsear la respuesta
            let data
            try {
                data = JSON.parse(responseText)
            } catch (e) {
                console.error("Error parsing response:", e)
                throw new Error(`Server returned invalid JSON: ${responseText.substring(0, 200)}`)
            }

            if (!res.ok) {
                throw new Error(data.error || `HTTP error! status: ${res.status}`)
            }

            if (data.success) {
                toast({
                    title: selectedContact ? "Contacto actualizado" : "Contacto creado",
                    description: `El contacto se ${selectedContact ? 'actualizó' : 'creó'} correctamente.`
                })
                loadContacts()
                setDialogOpen(false)
            } else {
                throw new Error(data.error || "Failed to save contact")
            }
        } catch (error: any) {
            console.error("Error saving contact:", error)
            toast({
                variant: "destructive",
                title: "Error al guardar",
                description: error.message || "No se pudo guardar el contacto. Intenta nuevamente."
            })
            throw error
        }
    }

    const getStatusColor = useCallback((status: string) => {
        switch (status) {
            case "hot": return "bg-rose-500"
            case "warm": return "bg-amber-500"
            case "cold": return "bg-sky-500"
            case "converted": return "bg-emerald-500"
            case "lost": return "bg-slate-500"
            default: return "bg-slate-500"
        }
    }, [])

    // Bulk actions
    const handleBulkDelete = async (ids: string[]) => {
        const res = await fetch("/api/contacts/bulk", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast({
            title: "Contactos eliminados",
            description: `Se eliminaron ${data.deleted} contactos correctamente.`,
        })
        loadContacts()
    }

    const handleBulkStatusChange = async (ids: string[], status: string) => {
        const res = await fetch("/api/contacts/bulk", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids, updates: { lead_status: status } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast({
            title: "Estado actualizado",
            description: `Se actualizaron ${data.updated} contactos.`,
        })
        loadContacts()
    }

    const handleBulkExport = async (ids: string[]) => {
        const selectedContacts = contacts.filter(c => ids.includes(c.id))
        exportToCSV(selectedContacts, contactsExportColumns, "contactos_seleccionados")
        toast({
            title: "Exportación completada",
            description: `Se exportaron ${selectedContacts.length} contactos.`,
        })
    }

    const bulkActions = [
        {
            id: "export",
            label: "Exportar",
            icon: Download,
            action: handleBulkExport,
        },
        {
            id: "status-hot",
            label: "Marcar Hot",
            icon: Tag,
            action: (ids: string[]) => handleBulkStatusChange(ids, "hot"),
        },
        {
            id: "status-cold",
            label: "Marcar Cold",
            icon: Tag,
            action: (ids: string[]) => handleBulkStatusChange(ids, "cold"),
        },
        {
            id: "delete",
            label: "Eliminar",
            icon: Trash2,
            variant: "destructive" as const,
            requireConfirm: true,
            confirmTitle: "¿Eliminar contactos?",
            confirmDescription: `Esta acción eliminará permanentemente los contactos seleccionados y no se puede deshacer.`,
            action: handleBulkDelete,
        },
    ]

    const allSelected = useMemo(() =>
        contacts.length > 0 && contacts.every(c => isSelected(c.id)),
        [contacts, isSelected]
    )
    const someSelected = useMemo(() =>
        contacts.some(c => isSelected(c.id)) && !allSelected,
        [contacts, isSelected, allSelected]
    )

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar contactos..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                    <Button type="submit" variant="secondary">Buscar</Button>
                </form>
                <div className="flex items-center gap-2">
                    <ExportButton
                        data={contacts}
                        columns={contactsExportColumns}
                        filename="contactos"
                    />
                    <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Importar
                    </Button>
                    <Button onClick={handleCreate} className="gradient-neon border-0">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Contacto
                    </Button>
                </div>
            </div>

            <div className="border rounded-xl overflow-hidden">
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
                                        if (checked) {
                                            selectAll(contacts)
                                        } else {
                                            clearSelection()
                                        }
                                    }}
                                    aria-label="Seleccionar todos"
                                />
                            </TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Empresa / Cargo</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8">
                                    <Loading text="Cargando contactos..." />
                                </TableCell>
                            </TableRow>
                        ) : contacts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                    No se encontraron contactos
                                </TableCell>
                            </TableRow>
                        ) : (
                            contacts.map((contact) => (
                                <TableRow
                                    key={contact.id}
                                    className={isSelected(contact.id) ? "bg-primary/5" : ""}
                                >
                                    <TableCell>
                                        <Checkbox
                                            checked={isSelected(contact.id)}
                                            onCheckedChange={() => toggleSelection(contact.id)}
                                            aria-label={`Seleccionar ${contact.name}`}
                                        />
                                    </TableCell>
                                    <TableCell className="font-medium">{contact.name}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{contact.company || "-"}</span>
                                            <span className="text-xs text-muted-foreground">{contact.position}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1 text-sm">
                                            {contact.email && (
                                                <div className="flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-muted-foreground" />
                                                    {contact.email}
                                                </div>
                                            )}
                                            {contact.phone && (
                                                <div className="flex items-center gap-1">
                                                    <Phone className="w-3 h-3 text-muted-foreground" />
                                                    {contact.phone}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={`${getStatusColor(contact.lead_status)} text-white border-0`}>
                                            {contact.lead_status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <LeadScoreBadge score={contact.lead_score || 0} />
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            {contact.phone && (
                                                <WhatsAppButton
                                                    phone={contact.phone}
                                                    contactName={contact.name}
                                                    contactId={contact.id}
                                                    variant="ghost"
                                                    size="icon"
                                                />
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(contact)}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(contact.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={setLimit}
                totalItems={total}
            />

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará permanentemente el contacto
                            y todos sus datos asociados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                            Eliminar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ContactDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                contact={selectedContact}
                onSave={handleSave}
            />

            <ImportModal
                open={importModalOpen}
                onOpenChange={setImportModalOpen}
                title="Importar Contactos"
                description="Importa contactos desde un archivo CSV"
                columns={contactsImportColumns}
                onImport={async (data) => {
                    const res = await fetch("/api/contacts/import", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ data }),
                    })
                    const json = await res.json()
                    if (json.success || json.imported > 0) {
                        loadContacts()
                    }
                    return json
                }}
            />

            {/* Bulk Actions Bar */}
            <BulkActionsBar
                selectedIds={selectedIds}
                onClearSelection={clearSelection}
                actions={bulkActions}
                entityName="contactos"
            />
        </div>
    )
}
