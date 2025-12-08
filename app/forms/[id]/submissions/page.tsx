"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ArrowLeft, Eye, User, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Submission {
  id: string
  data: Record<string, any>
  status: string
  ip_address: string
  user_agent: string
  referrer: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  created_at: string
  contact: {
    id: string
    name: string
    email: string
    phone: string
    lead_status: string
  } | null
}

interface WebForm {
  id: string
  name: string
  slug: string
  fields: { id: string; label: string; type: string }[]
}

export default function FormSubmissionsPage() {
  const params = useParams()
  const router = useRouter()
  const formId = params?.id as string

  const [form, setForm] = useState<WebForm | null>(null)
  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formId])

  const fetchData = async () => {
    try {
      // Fetch form details
      const formRes = await fetch(`/api/forms/${formId}`)
      if (!formRes.ok) throw new Error('Formulario no encontrado')
      const formData = await formRes.json()
      setForm(formData)

      // Fetch submissions
      const subRes = await fetch(`/api/forms/${formId}/submissions`)
      if (!subRes.ok) throw new Error('Error al cargar envíos')
      const subData = await subRes.json()
      setSubmissions(subData.submissions)
      setTotal(subData.total)
    } catch (error) {
      toast.error('Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const getFieldLabel = (fieldId: string): string => {
    const field = form?.fields.find(f => f.id === fieldId)
    return field?.label || fieldId
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '-'
    if (typeof value === 'boolean') return value ? 'Sí' : 'No'
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge>Nuevo</Badge>
      case 'processed':
        return <Badge variant="secondary">Procesado</Badge>
      case 'spam':
        return <Badge variant="destructive">Spam</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const openDetail = (submission: Submission) => {
    setSelectedSubmission(submission)
    setDetailOpen(true)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/forms')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Envíos del formulario</h1>
            <p className="text-muted-foreground">{form?.name || 'Cargando...'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total envíos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Nuevos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {submissions.filter(s => s.status === 'new').length}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Con contacto creado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {submissions.filter(s => s.contact).length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Datos principales</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Fuente</TableHead>
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
                ) : submissions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No hay envíos todavía
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.map((submission) => (
                    <TableRow key={submission.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(submission.created_at), "d MMM yyyy HH:mm", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          {Object.entries(submission.data).slice(0, 2).map(([key, value]) => (
                            <p key={key} className="text-sm truncate">
                              <span className="text-muted-foreground">{getFieldLabel(key)}:</span>{' '}
                              {formatValue(value)}
                            </p>
                          ))}
                          {Object.keys(submission.data).length > 2 && (
                            <p className="text-xs text-muted-foreground">
                              +{Object.keys(submission.data).length - 2} campos más
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(submission.status)}</TableCell>
                      <TableCell>
                        {submission.contact ? (
                          <Button
                            variant="link"
                            size="sm"
                            className="p-0 h-auto"
                            onClick={() => router.push(`/contacts/${submission.contact!.id}`)}
                          >
                            <User className="h-3 w-3 mr-1" />
                            {submission.contact.name}
                          </Button>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {submission.utm_source ? (
                          <span className="text-sm">{submission.utm_source}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">Directo</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openDetail(submission)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del envío</DialogTitle>
          </DialogHeader>
          
          {selectedSubmission && (
            <div className="space-y-4">
              {/* Datos del formulario */}
              <div>
                <h4 className="font-medium mb-2">Datos enviados</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  {Object.entries(selectedSubmission.data).map(([key, value]) => (
                    <div key={key} className="flex justify-between">
                      <span className="text-muted-foreground">{getFieldLabel(key)}</span>
                      <span className="font-medium">{formatValue(value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Contacto vinculado */}
              {selectedSubmission.contact && (
                <div>
                  <h4 className="font-medium mb-2">Contacto creado</h4>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{selectedSubmission.contact.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedSubmission.contact.email}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetailOpen(false)
                          router.push(`/contacts/${selectedSubmission.contact!.id}`)
                        }}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div>
                <h4 className="font-medium mb-2">Información técnica</h4>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>IP: {selectedSubmission.ip_address || '-'}</p>
                  <p>Referrer: {selectedSubmission.referrer || '-'}</p>
                  {selectedSubmission.utm_source && (
                    <p>UTM: {selectedSubmission.utm_source} / {selectedSubmission.utm_medium} / {selectedSubmission.utm_campaign}</p>
                  )}
                  <p className="text-xs truncate">UA: {selectedSubmission.user_agent || '-'}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
