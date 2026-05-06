"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Trash2, Tag, Download } from "lucide-react"
import { ContactDialog } from "./contact-dialog"
import { ImportModal } from "@/components/data/import-modal"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { contactsExportColumns, exportToCSV } from "@/lib/export-utils"
import { contactsImportColumns } from "@/lib/import-utils"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { useToast } from "@/hooks/use-toast"
import { ContactsTableToolbar } from "@/components/contacts/contacts-table/contacts-table-toolbar"
import { ContactsTableGrid } from "@/components/contacts/contacts-table/contacts-table-grid"
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
            if (process.env.NODE_ENV !== "production") {

                console.error("Error loading contacts:", error)
            }
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
            if (process.env.NODE_ENV !== "production") {

                console.error("Error deleting contact:", error)
            }
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

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(contactData)
            })

            // Leer la respuesta como texto primero para debug
            const responseText = await res.text()

            // Parsear la respuesta
            let data
            try {
                data = JSON.parse(responseText)
            } catch (e) {
                if (process.env.NODE_ENV !== "production") {

                    console.error("Error parsing response:", e)
                }
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
            if (process.env.NODE_ENV !== "production") {

                console.error("Error saving contact:", error)
            }
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
            <ContactsTableToolbar
                contacts={contacts}
                search={search}
                onSearchChange={setSearch}
                onSubmitSearch={handleSearch}
                onOpenImport={() => setImportModalOpen(true)}
                onCreate={handleCreate}
            />

            <ContactsTableGrid
                contacts={contacts}
                loading={loading}
                allSelected={allSelected}
                someSelected={someSelected}
                onToggleAll={(checked) => {
                    if (checked) {
                        selectAll(contacts)
                    } else {
                        clearSelection()
                    }
                }}
                isSelected={isSelected}
                onToggleOne={toggleSelection}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                getStatusColor={getStatusColor}
            />

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
