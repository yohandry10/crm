"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Edit, Trash2, Download, CheckCircle, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { ticketsExportColumns, exportToCSV } from "@/lib/export-utils"

type Ticket = {
  id: string
  title: string
  description?: string | null
  status: string
  priority: string
  account_id?: string | null
  contact_id?: string | null
}

export function TicketsTable() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<Ticket>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  // Bulk selection
  const {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  } = useBulkSelection<Ticket>()

  const openEdit = (t: Ticket) => {
    setForm(t)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast({ title: "Ticket eliminado" })
      load()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message })
    } finally {
      setDeleteId(null)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      const res = await fetch(`/api/tickets?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      setTickets(json.data || [])
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al cargar tickets", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    try {
      const payload = {
        title: form.title || "",
        description: null,
        status: form.status || "open",
        priority: form.priority || "medium",
        account_id: form.account_id || null,
        contact_id: form.contact_id || null,
        metadata: {},
      }
      const res = await fetch(form.id ? `/api/tickets/${form.id}` : "/api/tickets", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast({ title: "Ticket creado" })
      setDialogOpen(false)
      load()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar", description: error.message })
    }
  }

  // Bulk actions
  const handleBulkDelete = async (ids: string[]) => {
    const res = await fetch("/api/tickets/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    toast({ title: `Se eliminaron ${data.deleted} tickets` })
    load()
  }

  const handleBulkStatusChange = async (ids: string[], newStatus: string) => {
    const res = await fetch("/api/tickets/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, updates: { status: newStatus } }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    toast({ title: `Se actualizaron ${data.updated} tickets` })
    load()
  }

  const handleBulkExport = async (ids: string[]) => {
    const selectedTickets = tickets.filter(t => ids.includes(t.id))
    exportToCSV(selectedTickets, ticketsExportColumns, "tickets_seleccionados")
    toast({ title: `Se exportaron ${selectedTickets.length} tickets` })
  }

  const bulkActions = [
    {
      id: "export",
      label: "Exportar",
      icon: Download,
      action: handleBulkExport,
    },
    {
      id: "resolve",
      label: "Resolver",
      icon: CheckCircle,
      action: (ids: string[]) => handleBulkStatusChange(ids, "resolved"),
    },
    {
      id: "urgent",
      label: "Urgente",
      icon: AlertTriangle,
      action: async (ids: string[]) => {
        const res = await fetch("/api/tickets/bulk", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids, updates: { priority: "urgent" } }),
        })
        const data = await res.json()
        if (!data.success) throw new Error(data.error)
        toast({ title: `Se marcaron ${data.updated} tickets como urgentes` })
        load()
      },
    },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      variant: "destructive" as const,
      requireConfirm: true,
      confirmTitle: "¿Eliminar tickets?",
      confirmDescription: "Esta acción eliminará permanentemente los tickets seleccionados.",
      action: handleBulkDelete,
    },
  ]

  const allSelected = tickets.length > 0 && tickets.every(t => isSelected(t.id))
  const someSelected = tickets.some(t => isSelected(t.id)) && !allSelected

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select onValueChange={(v) => setStatus(v)} defaultValue={status}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Abiertos</SelectItem>
            <SelectItem value="in_progress">En progreso</SelectItem>
            <SelectItem value="waiting">En espera</SelectItem>
            <SelectItem value="resolved">Resueltos</SelectItem>
            <SelectItem value="closed">Cerrados</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={load}>Filtrar</Button>
        <Button className="ml-auto" onClick={() => { setForm({}); setDialogOpen(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo ticket
        </Button>
      </div>

      <div className="border rounded-md">
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
                    if (checked) selectAll(tickets)
                    else clearSelection()
                  }}
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              <TableHead>Título</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Prioridad</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>
            ) : tickets.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sin tickets</TableCell></TableRow>
            ) : (
              tickets.map(t => (
                <TableRow key={t.id} className={isSelected(t.id) ? "bg-primary/5" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={isSelected(t.id)}
                      onCheckedChange={() => toggleSelection(t.id)}
                      aria-label={`Seleccionar ${t.title}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{t.title}</TableCell>
                  <TableCell><Badge>{t.status}</Badge></TableCell>
                  <TableCell><Badge variant="outline">{t.priority}</Badge></TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(t.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar ticket" : "Nuevo ticket"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título*</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea 
                value={form.description || ""} 
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe el problema o solicitud..."
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Estado</Label>
                <Select value={form.status || "open"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Abierto</SelectItem>
                    <SelectItem value="in_progress">En progreso</SelectItem>
                    <SelectItem value="waiting">En espera</SelectItem>
                    <SelectItem value="resolved">Resuelto</SelectItem>
                    <SelectItem value="closed">Cerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prioridad</Label>
                <Select value={form.priority || "medium"} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={save}>{form.id ? "Actualizar" : "Guardar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="¿Eliminar ticket?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        selectedIds={selectedIds}
        onClearSelection={clearSelection}
        actions={bulkActions}
        entityName="tickets"
      />
    </div>
  )
}
