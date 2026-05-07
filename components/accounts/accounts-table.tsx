"use client"

import { useState, useEffect } from "react"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit, Trash2, Search, Plus, Building2 } from "lucide-react"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { Loading } from "@/components/ui/loading"
import { toast } from "sonner"
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface Account {
    id: string
    name: string
    ruc: string | null
    industry: string | null
    phone: string | null
    website: string | null
    address: string | null
    created_at: string
}

export function AccountsTable() {
    const [accounts, setAccounts] = useState<Account[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [page, setPage] = useState(1)
    const [limit, setLimit] = useState(10)
    const [total, setTotal] = useState(0)
    const [totalPages, setTotalPages] = useState(0)

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [accountToDelete, setAccountToDelete] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
    const [formData, setFormData] = useState({
        name: "", ruc: "", industry: "", phone: "", website: "", address: ""
    })

    useEffect(() => {
        loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, limit])

    const loadAccounts = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("page", page.toString())
            params.append("limit", limit.toString())

            const res = await fetch(`/api/accounts?${params.toString()}`)
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)

            const data = await res.json()
            if (data.success) {
                setAccounts(data.data || [])
                if (data.pagination) {
                    setTotal(data.pagination.total)
                    setTotalPages(data.pagination.totalPages || Math.ceil(data.pagination.total / limit))
                }
            }
        } catch (error: any) {
            console.error("Error loading accounts:", error)
            toast.error("Error al cargar cuentas")
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        setPage(1)
        loadAccounts()
    }

    const handleCreate = () => {
        setSelectedAccount(null)
        setFormData({ name: "", ruc: "", industry: "", phone: "", website: "", address: "" })
        setDialogOpen(true)
    }

    const handleEdit = (account: Account) => {
        setSelectedAccount(account)
        setFormData({
            name: account.name || "",
            ruc: account.ruc || "",
            industry: account.industry || "",
            phone: account.phone || "",
            website: account.website || "",
            address: account.address || ""
        })
        setDialogOpen(true)
    }

    const handleSave = async () => {
        try {
            const url = selectedAccount ? `/api/accounts/${selectedAccount.id}` : "/api/accounts"
            const method = selectedAccount ? "PUT" : "POST"
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            })
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
            const data = await res.json()
            if (data.success) {
                toast.success(selectedAccount ? "Cuenta actualizada" : "Cuenta creada")
                loadAccounts()
                setDialogOpen(false)
            }
        } catch {
            toast.error("Error al guardar cuenta")
        }
    }

    const handleDeleteClick = (id: string) => {
        setAccountToDelete(id)
        setDeleteDialogOpen(true)
    }

    const handleDelete = async () => {
        if (!accountToDelete) return
        try {
            const res = await fetch(`/api/accounts/${accountToDelete}`, { method: "DELETE" })
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`)
            const data = await res.json()
            if (data.success) {
                toast.success("Cuenta eliminada")
                loadAccounts()
            }
        } catch {
            toast.error("Error al eliminar cuenta")
        } finally {
            setDeleteDialogOpen(false)
            setAccountToDelete(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <form onSubmit={handleSearch} className="flex-1 flex gap-2 max-w-sm">
                    <div className="relative flex-1">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar cuentas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                    </div>
                    <Button type="submit" variant="secondary">Buscar</Button>
                </form>
                <Button onClick={handleCreate} className="gradient-neon border-0">
                    <Plus className="w-4 h-4 mr-2" />Nueva Cuenta
                </Button>
            </div>

            <div className="border rounded-xl overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Empresa</TableHead>
                            <TableHead>RUC</TableHead>
                            <TableHead>Industria</TableHead>
                            <TableHead>Website</TableHead>
                            <TableHead>Telefono</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8"><Loading text="Cargando cuentas..." /></TableCell></TableRow>
                        ) : accounts.length === 0 ? (
                            <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No se encontraron cuentas</TableCell></TableRow>
                        ) : (
                            accounts.map((account) => (
                                <TableRow key={account.id}>
                                    <TableCell className="font-medium"><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" />{account.name}</div></TableCell>
                                    <TableCell>{account.ruc || "-"}</TableCell>
                                    <TableCell>{account.industry || "-"}</TableCell>
                                    <TableCell>{account.website || "-"}</TableCell>
                                    <TableCell>{account.phone || "-"}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" onClick={() => handleEdit(account)}><Edit className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(account.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <PaginationControls currentPage={page} totalPages={totalPages} onPageChange={setPage} limit={limit} onLimitChange={setLimit} totalItems={total} />

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>{selectedAccount ? "Editar Cuenta" : "Nueva Cuenta"}</DialogTitle></DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2"><Label htmlFor="account-name">Nombre *</Label><Input id="account-name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label htmlFor="account-ruc">RUC</Label><Input id="account-ruc" value={formData.ruc} onChange={(e) => setFormData({...formData, ruc: e.target.value})} /></div>
                            <div className="grid gap-2"><Label htmlFor="account-phone">Telefono</Label><Input id="account-phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} /></div>
                        </div>
                        <div className="grid gap-2"><Label htmlFor="account-industry">Industria</Label><Input id="account-industry" value={formData.industry} onChange={(e) => setFormData({...formData, industry: e.target.value})} /></div>
                        <div className="grid gap-2"><Label htmlFor="account-website">Website</Label><Input id="account-website" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} /></div>
                        <div className="grid gap-2"><Label htmlFor="account-address">Direccion</Label><Input id="account-address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={!formData.name}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar cuenta?</AlertDialogTitle>
                        <AlertDialogDescription>Esta accion no se puede deshacer.</AlertDialogDescription>
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
