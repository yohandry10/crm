"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Edit, 
  Trash2, 
  Code,
  FileText
} from "lucide-react"
import { toast } from "sonner"
import { FormDialog } from "@/components/forms/form-dialog"
import { EmbedCodeDialog } from "@/components/forms/embed-code-dialog"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

interface WebForm {
  id: string
  name: string
  slug: string
  description?: string
  fields: any[]
  is_active: boolean
  views_count: number
  submissions_count: number
  created_at: string
  success_message?: string
  redirect_url?: string
  auto_create_contact: boolean
  default_lead_status: string
  default_lead_source: string
  default_tags: string[]
  notify_on_submit: boolean
  notify_emails: string[]
  theme?: {
    primaryColor: string
    backgroundColor: string
  }
}

export default function FormsPage() {
  const [forms, setForms] = useState<WebForm[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingForm, setEditingForm] = useState<WebForm | null>(null)
  const [embedDialogOpen, setEmbedDialogOpen] = useState(false)
  const [selectedFormForEmbed, setSelectedFormForEmbed] = useState<WebForm | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formToDelete, setFormToDelete] = useState<WebForm | null>(null)

  useEffect(() => {
    fetchForms()
  }, [])

  const fetchForms = async () => {
    try {
      const res = await fetch('/api/forms')
      if (!res.ok) throw new Error('Error al cargar formularios')
      const data = await res.json()
      setForms(data)
    } catch (_error) {
      toast.error('Error al cargar formularios')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!formToDelete) return
    
    try {
      const res = await fetch(`/api/forms/${formToDelete.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      
      setForms(forms.filter(f => f.id !== formToDelete.id))
      toast.success('Formulario eliminado')
    } catch (_error) {
      toast.error('Error al eliminar formulario')
    } finally {
      setDeleteDialogOpen(false)
      setFormToDelete(null)
    }
  }

  const toggleActive = async (form: WebForm) => {
    try {
      const res = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, is_active: !form.is_active })
      })
      if (!res.ok) throw new Error('Error al actualizar')
      
      setForms(forms.map(f => 
        f.id === form.id ? { ...f, is_active: !f.is_active } : f
      ))
      toast.success(form.is_active ? 'Formulario desactivado' : 'Formulario activado')
    } catch (_error) {
      toast.error('Error al actualizar formulario')
    }
  }

  const filteredForms = forms.filter(form =>
    form.name.toLowerCase().includes(search.toLowerCase()) ||
    form.slug.toLowerCase().includes(search.toLowerCase())
  )

  const conversionRate = (form: WebForm) => {
    if (form.views_count === 0) return '0%'
    return ((form.submissions_count / form.views_count) * 100).toFixed(1) + '%'
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Formularios Web</h1>
            <p className="text-muted-foreground">
              Crea formularios para capturar leads desde tu sitio web
            </p>
          </div>
          <Button onClick={() => { setEditingForm(null); setDialogOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Formulario
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Formularios</CardDescription>
              <CardTitle className="text-2xl">{forms.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activos</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {forms.filter(f => f.is_active).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Vistas</CardDescription>
              <CardTitle className="text-2xl">
                {forms.reduce((acc, f) => acc + f.views_count, 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Envíos</CardDescription>
              <CardTitle className="text-2xl">
                {forms.reduce((acc, f) => acc + f.submissions_count, 0).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar formularios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-center">Campos</TableHead>
                  <TableHead className="text-center">Vistas</TableHead>
                  <TableHead className="text-center">Envíos</TableHead>
                  <TableHead className="text-center">Conversión</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Cargando...
                    </TableCell>
                  </TableRow>
                ) : filteredForms.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      {search ? 'No se encontraron formularios' : 'No hay formularios creados'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredForms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{form.name}</p>
                          <p className="text-sm text-muted-foreground">/f/{form.slug}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={form.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => toggleActive(form)}
                        >
                          {form.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">{form.fields.length}</TableCell>
                      <TableCell className="text-center">{form.views_count.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{form.submissions_count.toLocaleString()}</TableCell>
                      <TableCell className="text-center">{conversionRate(form)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(`/f/${form.slug}`, '_blank')}>
                              <Eye className="mr-2 h-4 w-4" />
                              Vista previa
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setEditingForm(form); setDialogOpen(true) }}>
                              <Edit className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedFormForEmbed(form); setEmbedDialogOpen(true) }}>
                              <Code className="mr-2 h-4 w-4" />
                              Código embed
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.location.href = `/forms/${form.id}/submissions`}>
                              <FileText className="mr-2 h-4 w-4" />
                              Ver envíos
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => { setFormToDelete(form); setDeleteDialogOpen(true) }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={editingForm}
        onSuccess={() => {
          fetchForms()
          setDialogOpen(false)
        }}
      />

      <EmbedCodeDialog
        open={embedDialogOpen}
        onOpenChange={setEmbedDialogOpen}
        form={selectedFormForEmbed}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar formulario"
        description={`¿Estás seguro de eliminar "${formToDelete?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={handleDelete}
      />
    </DashboardLayout>
  )
}
