"use client"

import { useEffect, useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Edit, Trash2, Search } from "lucide-react"

type Account = {
  id: string
  name: string
  ruc?: string | null
  industry?: string | null
  phone?: string | null
  city?: string | null
  country?: string | null
  created_at?: string
}

export function AccountsTable() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<Partial<Account>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const { toast } = useToast()

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast({ title: "Cuenta eliminada" })
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
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      const res = await fetch(`/api/accounts?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      setAccounts(json.data || [])
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al cargar cuentas", description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm({})
    setDialogOpen(true)
  }

  const openEdit = (acc: Account) => {
    setEditing(acc)
    setForm(acc)
    setDialogOpen(true)
  }

  const save = async () => {
    try {
      const payload = {
        name: form.name || "",
        ruc: form.ruc || null,
        industry: form.industry || null,
        phone: form.phone || null,
        city: form.city || null,
        country: form.country || null,
        notes: null,
        metadata: {},
      }
      // ✅ FIX: PUT debe ir a /api/accounts/[id], no a /api/accounts
      const url = editing ? `/api/accounts/${editing.id}` : "/api/accounts"
      const res = await fetch(url, {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast({ title: editing ? "Cuenta actualizada" : "Cuenta creada" })
      setDialogOpen(false)
      load()
    } catch (error: any) {
      toast({ variant: "destructive", title: "Error al guardar", description: error.message })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cuentas..."
            className="pl-8"
          />
        </div>
        <Button variant="secondary" onClick={load}>Buscar</Button>
        <Button onClick={openCreate} className="ml-auto">
          <Plus className="w-4 h-4 mr-2" /> Nueva cuenta
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>RUC</TableHead>
              <TableHead>Industria</TableHead>
              <TableHead>Contacto</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5}>Cargando...</TableCell></TableRow>
            ) : accounts.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-muted-foreground">Sin cuentas</TableCell></TableRow>
            ) : (
              accounts.map(acc => (
                <TableRow key={acc.id}>
                  <TableCell className="font-medium">{acc.name}</TableCell>
                  <TableCell>{acc.ruc || "-"}</TableCell>
                  <TableCell>{acc.industry || "-"}</TableCell>
                  <TableCell>{acc.phone || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(acc)}><Edit className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDeleteId(acc.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
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
            <DialogTitle>{editing ? "Editar cuenta" : "Nueva cuenta"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nombre*</Label>
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>RUC</Label>
                <Input value={form.ruc || ""} onChange={(e) => setForm({ ...form, ruc: e.target.value })} />
              </div>
              <div>
                <Label>Industria</Label>
                <Input value={form.industry || ""} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Teléfono</Label>
                <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Ciudad</Label>
                <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <Button onClick={save}>{editing ? "Actualizar" : "Guardar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="¿Eliminar cuenta?"
        description="Esta acción no se puede deshacer. Se eliminarán todos los datos asociados a esta cuenta."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />
    </div>
  )
}
