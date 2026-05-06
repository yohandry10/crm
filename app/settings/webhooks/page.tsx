"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  Webhook,
  Plus,
  Trash2,
  Play,
  Loader2,
} from "lucide-react"

const WEBHOOK_EVENTS = [
  { id: "contact.created", name: "Contacto creado", category: "Contactos" },
  { id: "contact.updated", name: "Contacto actualizado", category: "Contactos" },
  { id: "lead.created", name: "Lead creado", category: "Leads" },
  { id: "lead.converted", name: "Lead convertido", category: "Leads" },
  { id: "opportunity.created", name: "Oportunidad creada", category: "Ventas" },
  { id: "opportunity.won", name: "Oportunidad ganada", category: "Ventas" },
  { id: "opportunity.lost", name: "Oportunidad perdida", category: "Ventas" },
  { id: "invoice.created", name: "Factura creada", category: "Facturación" },
  { id: "invoice.paid", name: "Factura pagada", category: "Facturación" },
  { id: "task.created", name: "Tarea creada", category: "Tareas" },
  { id: "task.completed", name: "Tarea completada", category: "Tareas" },
]

const DEFAULT_WEBHOOK_EVENTS = ["contact.created"]

interface WebhookType {
  id: string
  name: string
  url: string
  events: string[]
  is_active: boolean
  secret: string
}

export default function WebhooksSettingsPage() {
  const [webhooks, setWebhooks] = useState<WebhookType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [webhookToDelete, setWebhookToDelete] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    events: [...DEFAULT_WEBHOOK_EVENTS] as string[],
  })

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    try {
      const res = await fetch("/api/webhooks")
      if (res.ok) {
        const data = await res.json()
        setWebhooks(data.data || [])
      }
    } catch (error) {
      toast.error("Error al cargar webhooks")
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.url || formData.events.length === 0) {
      toast.error("Completa todos los campos")
      return
    }

    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!res.ok) throw new Error("Failed to create")

      const data = await res.json()
      toast.success("Webhook creado")
      
      // Show secret once
      if (data.data?.secret) {
        toast.info(`Secret: ${data.data.secret}`, { duration: 10000 })
      }

      setDialogOpen(false)
      setFormData({ name: "", url: "", events: [...DEFAULT_WEBHOOK_EVENTS] })
      fetchWebhooks()
    } catch (error) {
      toast.error("Error al crear webhook")
    }
  }

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/webhooks/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      })

      if (!res.ok) throw new Error("Failed to update")

      setWebhooks(prev =>
        prev.map(w => (w.id === id ? { ...w, is_active: isActive } : w))
      )
      toast.success(isActive ? "Webhook activado" : "Webhook desactivado")
    } catch (error) {
      toast.error("Error al actualizar")
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Failed to delete")

      setWebhooks(prev => prev.filter(w => w.id !== id))
      toast.success("Webhook eliminado")
    } catch (error) {
      toast.error("Error al eliminar")
    } finally {
      setWebhookToDelete(null)
    }
  }

  const handleTest = async (id: string) => {
    setTesting(id)
    try {
      const res = await fetch(`/api/webhooks/${id}`, { method: "POST" })
      const data = await res.json()

      if (data.success) {
        toast.success(`Test exitoso (Status: ${data.data.status})`)
      } else {
        toast.error(`Test fallido: ${data.error || data.data?.response}`)
      }
    } catch (error) {
      toast.error("Error al probar webhook")
    } finally {
      setTesting(null)
    }
  }

  const toggleEvent = (eventId: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }))
  }

  const groupedEvents = WEBHOOK_EVENTS.reduce((acc, event) => {
    if (!acc[event.category]) acc[event.category] = []
    acc[event.category].push(event)
    return acc
  }, {} as Record<string, typeof WEBHOOK_EVENTS>)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-muted-foreground">
              Recibe notificaciones en tiempo real cuando ocurren eventos
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Webhook
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Crear Webhook</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nombre</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Mi integración"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL del endpoint</Label>
                  <Input
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://mi-servidor.com/webhook"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Eventos</Label>
                  <div className="border rounded-lg p-4 max-h-64 overflow-y-auto space-y-4">
                    {Object.entries(groupedEvents).map(([category, events]) => (
                      <div key={category}>
                        <p className="font-medium text-sm mb-2">{category}</p>
                        <div className="space-y-2">
                          {events.map((event) => (
                            <div key={event.id} className="flex items-center gap-2">
                              <Checkbox
                                id={event.id}
                                checked={formData.events.includes(event.id)}
                                onCheckedChange={() => toggleEvent(event.id)}
                              />
                              <label htmlFor={event.id} className="text-sm cursor-pointer">
                                {event.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Crear Webhook
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Webhook className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No hay webhooks configurados</p>
              <Button variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
                Crear primer webhook
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {webhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{webhook.name}</h3>
                        <Badge variant={webhook.is_active ? "default" : "secondary"}>
                          {webhook.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground font-mono">{webhook.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) => handleToggle(webhook.id, checked)}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleTest(webhook.id)}
                        disabled={testing === webhook.id}
                      >
                        {testing === webhook.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setWebhookToDelete(webhook.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Documentation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Documentación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Formato del payload</h4>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`{
  "event": "contact.created",
  "timestamp": 1701234567890,
  "data": {
    "id": "uuid",
    "name": "Juan Pérez",
    "email": "juan@ejemplo.com",
    ...
  }
}`}
              </pre>
            </div>
            <div>
              <h4 className="font-medium mb-2">Verificación de firma</h4>
              <p className="text-sm text-muted-foreground mb-2">
                Cada request incluye un header X-Webhook-Signature con HMAC-SHA256 del body.
              </p>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
{`const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', YOUR_SECRET)
  .update(requestBody)
  .digest('hex');

if (signature === req.headers['x-webhook-signature']) {
  // Válido
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={!!webhookToDelete}
          onOpenChange={(open) => !open && setWebhookToDelete(null)}
          title="Eliminar Webhook"
          description="¿Estás seguro de eliminar este webhook? Esta acción no se puede deshacer."
          confirmText="Eliminar"
          cancelText="Cancelar"
          variant="destructive"
          onConfirm={() => webhookToDelete && handleDelete(webhookToDelete)}
        />
      </div>
    </DashboardLayout>
  )
}
