"use client"

import { useState, useEffect } from "react"
import { TutorialButton } from "@/components/tutorials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Search, Package, Edit, Trash2, Loader2, Upload, Download, Power, PowerOff } from "lucide-react"
import { toast } from "sonner"
import { ExportButton } from "@/components/data/export-button"
import { ImportModal } from "@/components/data/import-modal"
import { BulkActionsBar, useBulkSelection } from "@/components/bulk/bulk-actions-bar"
import { productsExportColumns, exportToCSV } from "@/lib/export-utils"
import { productsImportColumns } from "@/lib/import-utils"

interface Product {
  id: string
  sku: string
  name: string
  description: string
  unit_price: number
  cost_price: number
  stock_quantity: number
  is_service: boolean
  is_active: boolean
  category?: { name: string }
}

export function ProductsCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<Partial<Product>>({})
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Bulk selection
  const {
    selectedIds,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
  } = useBulkSelection<Product>()

  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)

      const res = await fetch(`/api/products?${params}`)
      const data = await res.json()

      if (data.success) {
        setProducts(data.data)
      }
    } catch (_error) {
      toast.error("Error al cargar productos")
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount)
  }

  const openCreate = () => {
    setForm({ is_active: true, is_service: false, stock_quantity: 0, unit_price: 0 })
    setDialogOpen(true)
  }

  const openEdit = (product: Product) => {
    setForm(product)
    setDialogOpen(true)
  }

  const save = async () => {
    try {
      const payload = {
        name: form.name || "",
        sku: form.sku || null,
        description: form.description || null,
        unit_price: form.unit_price || 0,
        cost_price: form.cost_price || 0,
        stock_quantity: form.stock_quantity || 0,
        is_service: form.is_service || false,
        is_active: form.is_active !== false,
      }

      const res = await fetch(form.id ? `/api/products/${form.id}` : "/api/products", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")

      toast.success(form.id ? "Producto actualizado" : "Producto creado")
      setDialogOpen(false)
      setForm({})
      setProducts((current) => {
        if (!json.data) return current
        if (form.id) return current.map((product) => product.id === json.data.id ? json.data : product)
        return [json.data, ...current.filter((product) => product.id !== json.data.id)]
      })
      fetchProducts()
    } catch (error: any) {
      toast.error(error.message || "Error al guardar")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: "DELETE" })
      const json = await res.json()
      if (!json.success) throw new Error(json.error || "Error")
      toast.success("Producto eliminado")
      fetchProducts()
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar")
    } finally {
      setDeleteId(null)
    }
  }

  // Bulk actions
  const handleBulkDelete = async (ids: string[]) => {
    const res = await fetch("/api/products/bulk", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    toast.success(`Se eliminaron ${data.deleted} productos`)
    fetchProducts()
  }

  const handleBulkActivate = async (ids: string[], active: boolean) => {
    const res = await fetch("/api/products/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, updates: { is_active: active } }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error)
    toast.success(`Se ${active ? "activaron" : "desactivaron"} ${data.updated} productos`)
    fetchProducts()
  }

  const handleBulkExport = async (ids: string[]) => {
    const selectedProducts = products.filter((p) => ids.includes(p.id))
    exportToCSV(selectedProducts, productsExportColumns, "productos_seleccionados")
    toast.success(`Se exportaron ${selectedProducts.length} productos`)
  }

  const bulkActions = [
    {
      id: "export",
      label: "Exportar",
      icon: Download,
      action: handleBulkExport,
    },
    {
      id: "activate",
      label: "Activar",
      icon: Power,
      action: (ids: string[]) => handleBulkActivate(ids, true),
    },
    {
      id: "deactivate",
      label: "Desactivar",
      icon: PowerOff,
      action: (ids: string[]) => handleBulkActivate(ids, false),
    },
    {
      id: "delete",
      label: "Eliminar",
      icon: Trash2,
      variant: "destructive" as const,
      requireConfirm: true,
      confirmTitle: "¿Eliminar productos?",
      confirmDescription: "Esta acción eliminará permanentemente los productos seleccionados.",
      action: handleBulkDelete,
    },
  ]

  const allSelected = products.length > 0 && products.every((p) => isSelected(p.id))
  const someSelected = products.some((p) => isSelected(p.id)) && !allSelected

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Productos y Servicios</h1>
          <p className="text-muted-foreground">Gestiona tu catálogo de productos</p>
        </div>
        <div className="flex items-center gap-2">
          <TutorialButton moduleId="products" />
          <ExportButton data={products} columns={productsExportColumns} filename="productos" />
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          <Button onClick={openCreate} className="gradient-neon border-0">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar productos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay productos registrados</p>
            </div>
          ) : (
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
                        if (checked) selectAll(products)
                        else clearSelection()
                      }}
                      aria-label="Seleccionar todos"
                    />
                  </TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id} className={isSelected(product.id) ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected(product.id)}
                        onCheckedChange={() => toggleSelection(product.id)}
                        aria-label={`Seleccionar ${product.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-mono">{product.sku || "-"}</TableCell>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>
                      <Badge variant={product.is_service ? "secondary" : "outline"}>
                        {product.is_service ? "Servicio" : "Producto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(product.unit_price)}</TableCell>
                    <TableCell className="text-right">{product.is_service ? "-" : product.stock_quantity}</TableCell>
                    <TableCell>
                      <Badge variant={product.is_active ? "default" : "secondary"}>
                        {product.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(product)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(product.id)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar producto" : "Nuevo producto"}</DialogTitle>
            <DialogDescription>
              {form.id
                ? "Modifica los detalles del producto existente."
                : "Ingresa los datos para registrar un nuevo producto en el catálogo."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre*</Label>
                <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label>SKU</Label>
                <Input value={form.sku || ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Precio Venta</Label>
                <Input
                  type="number"
                  value={form.unit_price || 0}
                  onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Precio Costo</Label>
                <Input
                  type="number"
                  value={form.cost_price || 0}
                  onChange={(e) => setForm({ ...form, cost_price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stock</Label>
                <Input
                  type="number"
                  value={form.stock_quantity || 0}
                  onChange={(e) => setForm({ ...form, stock_quantity: Number(e.target.value) })}
                  disabled={form.is_service}
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_service || false}
                    onCheckedChange={(checked) => setForm({ ...form, is_service: checked })}
                  />
                  <Label>Es servicio</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.is_active !== false}
                    onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
                  />
                  <Label>Activo</Label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={save}>{form.id ? "Actualizar" : "Guardar"}</Button>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="¿Eliminar producto?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteId && handleDelete(deleteId)}
        confirmText="Eliminar"
        cancelText="Cancelar"
      />

      <ImportModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="Importar Productos"
        description="Importa productos desde un archivo CSV"
        columns={productsImportColumns}
        onImport={async (data) => {
          const res = await fetch("/api/products/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data }),
          })
          const json = await res.json()
          if (json.success || json.imported > 0) {
            fetchProducts()
          }
          return json
        }}
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar selectedIds={selectedIds} onClearSelection={clearSelection} actions={bulkActions} entityName="productos" />
    </div>
  )
}
