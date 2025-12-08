"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Zap, Plus, Play, Settings, Trash2, Clock, Mail, Phone, MessageSquare } from "lucide-react"
import { toast } from "sonner"

interface WorkflowAction {
  id: string
  type: "send_email" | "send_whatsapp" | "update_lead_status" | "create_task" | "schedule_call"
  config: any
}

interface Workflow {
  id: string
  name: string
  description: string
  // ✅ FIX: Sincronizado con lib/schemas.ts trigger_type enum
  triggerType: "contact.created" | "contact.updated" | "invoice.sent" | "invoice.paid" | "payment.completed" | "opportunity.created" | "opportunity.updated" | "manual" | "schedule"
  triggerConditions: any
  actions: WorkflowAction[]
  isActive: boolean
  executionCount: number
  lastExecuted?: string
}

export function AutomationWorkflows() {
  // ✅ FIX: Ejemplos actualizados con trigger_types válidos según schema
  const [workflows, setWorkflows] = useState<Workflow[]>([
    {
      id: "1",
      name: "Bienvenida Nuevo Contacto",
      description: "Notificar cuando se crea un nuevo contacto",
      triggerType: "contact.created",
      triggerConditions: {},
      actions: [
        { id: "1", type: "send_email", config: { template: "welcome", recipient: "contact" } },
        { id: "2", type: "create_task", config: { description: "Contactar nuevo lead", assignee: "admin" } },
      ],
      isActive: true,
      executionCount: 15,
      lastExecuted: "2024-01-28",
    },
    {
      id: "2",
      name: "Factura Pagada",
      description: "Enviar agradecimiento cuando se paga una factura",
      triggerType: "invoice.paid",
      triggerConditions: {},
      actions: [
        { id: "1", type: "send_email", config: { template: "thank_you", recipient: "contact" } },
        { id: "2", type: "update_lead_status", config: { status: "converted" } },
      ],
      isActive: true,
      executionCount: 8,
      lastExecuted: "2024-01-27",
    },
    {
      id: "3",
      name: "Nueva Oportunidad",
      description: "Crear tarea cuando se crea una oportunidad",
      triggerType: "opportunity.created",
      triggerConditions: {},
      actions: [
        { id: "1", type: "send_email", config: { template: "opportunity_notification", recipient: "admin" } },
        { id: "2", type: "create_task", config: { description: "Seguimiento de oportunidad", assignee: "admin" } },
      ],
      isActive: false,
      executionCount: 3,
      lastExecuted: "2024-01-25",
    },
  ])

  const [isCreating, setIsCreating] = useState(false)
  const [newWorkflow, setNewWorkflow] = useState<{
    name: string
    description: string
    triggerType: string
    triggerConditions: Record<string, any>
    actions: WorkflowAction[]
  }>({
    name: "",
    description: "",
    triggerType: "",
    triggerConditions: {},
    actions: [],
  })

  const toggleWorkflow = async (id: string) => {
    setWorkflows(
      workflows.map((workflow) => (workflow.id === id ? { ...workflow, isActive: !workflow.isActive } : workflow)),
    )

    const workflow = workflows.find((w) => w.id === id)
    toast.success(`Workflow "${workflow?.name}" ${workflow?.isActive ? "desactivado" : "activado"}`)
  }

  const deleteWorkflow = async (id: string) => {
    const workflow = workflows.find((w) => w.id === id)
    setWorkflows(workflows.filter((w) => w.id !== id))
    toast.success(`Workflow "${workflow?.name}" eliminado`)
  }

  const getTriggerIcon = (type: string) => {
    switch (type) {
      case "contact.created":
      case "contact.updated":
        return <Zap className="h-4 w-4" />
      case "invoice.sent":
      case "invoice.paid":
        return <Mail className="h-4 w-4" />
      case "payment.completed":
        return <Settings className="h-4 w-4" />
      case "opportunity.created":
      case "opportunity.updated":
        return <MessageSquare className="h-4 w-4" />
      case "schedule":
        return <Clock className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getActionIcon = (type: string) => {
    switch (type) {
      case "send_email":
        return <Mail className="h-4 w-4" />
      case "send_whatsapp":
        return <MessageSquare className="h-4 w-4" />
      case "schedule_call":
        return <Phone className="h-4 w-4" />
      default:
        return <Settings className="h-4 w-4" />
    }
  }

  const getTriggerDescription = (workflow: Workflow) => {
    switch (workflow.triggerType) {
      case "contact.created":
        return "Cuando se crea un contacto"
      case "contact.updated":
        return "Cuando se actualiza un contacto"
      case "invoice.sent":
        return "Cuando se envía una factura"
      case "invoice.paid":
        return "Cuando se paga una factura"
      case "payment.completed":
        return "Cuando se completa un pago"
      case "opportunity.created":
        return "Cuando se crea una oportunidad"
      case "opportunity.updated":
        return "Cuando se actualiza una oportunidad"
      case "manual":
        return "Ejecución manual"
      case "schedule":
        return "Programado"
      default:
        return "Trigger personalizado"
    }
  }

  const getActionDescription = (action: WorkflowAction) => {
    switch (action.type) {
      case "send_email":
        return `Email: ${action.config.template}`
      case "send_whatsapp":
        return `WhatsApp: ${action.config.template}`
      case "update_lead_status":
        return `Cambiar status a ${action.config.status}`
      case "create_task":
        return `Crear tarea: ${action.config.description}`
      case "schedule_call":
        return `Programar llamada en ${action.config.daysFromNow} días`
      default:
        return "Acción personalizada"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-6 w-6 text-cyan-600" />
          <h2 className="text-2xl font-bold text-gray-900">Automatización de Flujos</h2>
        </div>
        <Button
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Crear Workflow
        </Button>
      </div>

      {/* Workflow Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-cyan-600" />
              <div>
                <div className="text-2xl font-bold">{workflows.length}</div>
                <div className="text-sm text-gray-600">Total Workflows</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Play className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-2xl font-bold">{workflows.filter((w) => w.isActive).length}</div>
                <div className="text-sm text-gray-600">Activos</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-orange-600" />
              <div>
                <div className="text-2xl font-bold">{workflows.reduce((sum, w) => sum + w.executionCount, 0)}</div>
                <div className="text-sm text-gray-600">Ejecuciones</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">
                  {workflows.filter((w) => w.lastExecuted === "2024-01-28").length}
                </div>
                <div className="text-sm text-gray-600">Hoy</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {workflows.map((workflow) => (
          <Card
            key={workflow.id}
            className={`${workflow.isActive ? "border-green-200 bg-green-50/30" : "border-gray-200"}`}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTriggerIcon(workflow.triggerType)}
                  <CardTitle className="text-lg">{workflow.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={workflow.isActive} onCheckedChange={() => toggleWorkflow(workflow.id)} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteWorkflow(workflow.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">{workflow.description}</p>

              <div className="space-y-3">
                <div>
                  <div className="text-sm font-medium text-gray-700 mb-1">Trigger:</div>
                  <Badge variant="outline" className="text-xs">
                    {getTriggerDescription(workflow)}
                  </Badge>
                </div>

                <div>
                  <div className="text-sm font-medium text-gray-700 mb-2">Acciones:</div>
                  <div className="space-y-1">
                    {workflow.actions.map((action) => (
                      <div key={action.id} className="flex items-center gap-2 text-xs">
                        {getActionIcon(action.type)}
                        <span>{getActionDescription(action)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Ejecutado {workflow.executionCount} veces</span>
                  {workflow.lastExecuted && <span>Último: {workflow.lastExecuted}</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Workflow Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Crear Nuevo Workflow</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
                  ×
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Nombre y descripción */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre del Workflow</label>
                  <input
                    type="text"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Ej: Seguimiento de leads calientes"
                    value={newWorkflow.name}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Describe qué hace este workflow..."
                    rows={2}
                    value={newWorkflow.description}
                    onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Trigger - ✅ FIX: Opciones sincronizadas con lib/schemas.ts */}
              <div>
                <label className="text-sm font-medium">Disparador (Trigger)</label>
                <select
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  value={newWorkflow.triggerType}
                  onChange={(e) => setNewWorkflow({ ...newWorkflow, triggerType: e.target.value })}
                >
                  <option value="">Seleccionar trigger...</option>
                  <option value="contact.created">Contacto Creado</option>
                  <option value="contact.updated">Contacto Actualizado</option>
                  <option value="invoice.sent">Factura Enviada</option>
                  <option value="invoice.paid">Factura Pagada</option>
                  <option value="payment.completed">Pago Completado</option>
                  <option value="opportunity.created">Oportunidad Creada</option>
                  <option value="opportunity.updated">Oportunidad Actualizada</option>
                  <option value="manual">Manual</option>
                  <option value="schedule">Programado</option>
                </select>
              </div>

              {/* Acciones */}
              <div>
                <label className="text-sm font-medium">Acciones</label>
                <div className="mt-2 space-y-2">
                  {(newWorkflow.actions as WorkflowAction[]).map((action, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      {getActionIcon(action.type)}
                      <span className="flex-1 text-sm">{getActionDescription(action)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setNewWorkflow({
                          ...newWorkflow,
                          actions: (newWorkflow.actions as WorkflowAction[]).filter((_, i) => i !== idx)
                        })}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewWorkflow({
                      ...newWorkflow,
                      actions: [...(newWorkflow.actions as WorkflowAction[]), {
                        id: crypto.randomUUID(),
                        type: "send_email",
                        config: { template: "notification", recipient: "contact" }
                      }]
                    })}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewWorkflow({
                      ...newWorkflow,
                      actions: [...(newWorkflow.actions as WorkflowAction[]), {
                        id: crypto.randomUUID(),
                        type: "create_task",
                        config: { description: "Seguimiento", assignee: "admin" }
                      }]
                    })}
                  >
                    <Settings className="h-4 w-4 mr-1" /> Tarea
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNewWorkflow({
                      ...newWorkflow,
                      actions: [...(newWorkflow.actions as WorkflowAction[]), {
                        id: crypto.randomUUID(),
                        type: "update_lead_status",
                        config: { status: "warm" }
                      }]
                    })}
                  >
                    <Zap className="h-4 w-4 mr-1" /> Cambiar Status
                  </Button>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button
                  className="bg-gradient-to-r from-cyan-500 to-blue-600"
                  disabled={!newWorkflow.name || !newWorkflow.triggerType || (newWorkflow.actions as WorkflowAction[]).length === 0}
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/workflows', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: newWorkflow.name,
                          description: newWorkflow.description,
                          trigger_type: newWorkflow.triggerType,
                          trigger_conditions: newWorkflow.triggerConditions,
                          actions: newWorkflow.actions,
                          is_active: true
                        })
                      })
                      
                      if (response.ok) {
                        const result = await response.json()
                        setWorkflows([...workflows, {
                          id: result.data?.id || crypto.randomUUID(),
                          name: newWorkflow.name,
                          description: newWorkflow.description,
                          triggerType: newWorkflow.triggerType as any,
                          triggerConditions: newWorkflow.triggerConditions,
                          actions: newWorkflow.actions as WorkflowAction[],
                          isActive: true,
                          executionCount: 0
                        }])
                        setNewWorkflow({ name: "", description: "", triggerType: "", triggerConditions: {}, actions: [] })
                        setIsCreating(false)
                        toast.success("Workflow creado exitosamente")
                      } else {
                        toast.error("Error al crear workflow")
                      }
                    } catch {
                      toast.error("Error de conexión")
                    }
                  }}
                >
                  Crear Workflow
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
