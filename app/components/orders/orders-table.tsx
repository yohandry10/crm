"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Edit, Trash2, Loader2 } from "lucide-react"

type Order = {
  id: string
  status: string
  total: number
  currency: string
  opportunity_id?: string | null
  account_id?: string | null
  contact_id?: string | null
  subtotal?: number | null
  tax?: number | null
  notes?: string | null
  created_at?: string
}

const statusLabels: Record<string, string> = {
  draft: "Borrador",
  confirmed: "Confirmado",
  fulfilled: "Completado",
  cancelled: "Cancelado"
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  confirmed: "default",
  fulfilled: "default",
  cancelled: "destructive"
}

export function OrdersTable() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<Order>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      const res = await fetch(`/api/orders?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      setOrders(json.data || [])
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al cargar pedidos", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (o: Order) => {
    setForm(o)
    setDialogOpen(true)
  }

  const save = async () => {
    try {
      const payload = {
        status: form.status || "draft",
        notes: form.notes || null,
        currency: form.currency || "PEN",
        subtotal: form.subtotal || 0,
        tax: form.tax || 0,
        total: form.total || 0,
        account_id: form.account_id || null,
        contact_id: form.contact_id || null,
        opportunity_id: form.opportunity_id || null,
        metadata: {},
      }
      const res = await fetch(form.id ? `/api/orders/${form.id}` : "/api/orders", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast({ title: form.id ? "Pedido actualizado" : "Pedido creado" })
      setDialogOpen(false)
      setForm({})
      load()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar", description: error.message })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/orders/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast({ title: "Pedido eliminado" })
      load()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al eliminar", description: error.message })
    } finally {
      setDeleteId(null)
    }
  }

  const formatCurrency = (amount: number, currency: string = "PEN") => {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency }).format(amount)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Select onValueChange={(v) => setStatus(v === "all" ? undefined : v)} defaultValue={status || "all"}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Borrador</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="fulfilled">Completado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="secondary" onClick={load}>Filtrar</Button>
        <Button className="ml-auto" onClick={() => { setForm({}); setDialogOpen(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Nuevo pedido
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground text-center py-8">
                  Sin pedidos
                </TableCell>
              </TableRow>
            ) : (
              orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium font-mono text-sm">{o.id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Badge variant={statusColors[o.status] || "secondary"}>
                      {statusLabels[o.status] || o.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(o.total || 0, o.currency)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(o)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(o.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
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
            <DialogTitle>{form.id ? "Editar pedido" : "Nuevo pedido"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-sm font-medium">Estado</label>
                <Select value={form.status || "draft"} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Borrador</SelectItem>
                    <SelectItem value="confirmed">Confirmado</SelectItem>
                    <SelectItem value="fulfilled">Completado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Moneda</label>
                <Select value={form.currency || "PEN"} onValueChange={(v) => setForm({ ...form, currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">PEN</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-sm font-medium">Subtotal</label>
                <Input 
                  type="number" 
                  value={form.subtotal ?? 0} 
                  onChange={(e) => {
                    const subtotal = Number(e.target.value)
                    const tax = subtotal * 0.18
                    setForm({ ...form, subtotal, tax, total: subtotal + tax })
                  }} 
                />
              </div>
              <div>
                <label className="text-sm font-medium">IGV (18%)</label>
                <Input type="number" value={form.tax ?? 0} readOnly className="bg-muted" />
              </div>
              <div>
                <label className="text-sm font-medium">Total</label>
                <Input type="number" value={form.total ?? 0} readOnly className="bg-muted font-bold" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Notas</label>
              <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save}>{form.id ? "Actualizar" : "Guardar"}</Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="¿Eliminar pedido?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  )
}
