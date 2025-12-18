"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Zap, Plus, Play, Settings, Trash2, Clock, Mail, Phone, MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useFieldArray, useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { WORKFLOW_ACTIONS, WORKFLOW_TRIGGERS, WORKFLOW_TRIGGER_OPTIONS } from "@/lib/workflow-constants"

interface WorkflowAction {
  id: string
  type: typeof WORKFLOW_ACTIONS[number]
  params: Record<string, any>
}

interface Workflow {
  id: string
  name: string
  description: string
  triggerType: typeof WORKFLOW_TRIGGERS[number]
  triggerConditions: Record<string, any>
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
        { id: "1", type: "send_email", params: { template: "welcome", to: "{{contact.email}}" } },
        { id: "2", type: "create_task", params: { description: "Contactar nuevo lead" } },
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
        { id: "1", type: "send_email", params: { template: "thank_you", to: "{{contact.email}}" } },
        { id: "2", type: "update_lead_status", params: { status: "converted" } },
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
        { id: "1", type: "send_email", params: { template: "opportunity_notification", to: "{{user.email}}" } },
        { id: "2", type: "create_task", params: { description: "Seguimiento de oportunidad" } },
      ],
      isActive: false,
      executionCount: 3,
      lastExecuted: "2024-01-25",
    },
  ])

  const [isCreating, setIsCreating] = useState(false)

  const workflowCreateSchema = z.object({
    name: z.string().min(1, "El nombre es requerido").max(200),
    description: z.string().optional().nullable(),
    trigger_type: z.enum(WORKFLOW_TRIGGERS, { message: "Selecciona un trigger válido" }),
    actions: z.array(z.object({
      id: z.string().min(1),
      type: z.enum(WORKFLOW_ACTIONS),
      params: z.record(z.any()),
    })).min(1, "Agrega al menos una acción"),
  })

  type WorkflowCreateFormData = z.infer<typeof workflowCreateSchema>

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WorkflowCreateFormData>({
    resolver: zodResolver(workflowCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      trigger_type: "contact.created",
      actions: [],
    },
  })

  const actionsArray = useFieldArray({
    control,
    name: "actions",
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
      case "delay":
        return <Clock className="h-4 w-4" />
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
        return `Email: ${action.params.template || action.params.subject || "Sin plantilla"}`
      case "update_lead_status":
        return `Cambiar status a ${action.params.status}`
      case "create_task":
        return `Crear tarea: ${action.params.description || action.params.title || "Tarea"}`
      case "delay":
        return `Esperar: ${action.params.ms ? `${action.params.ms}ms` : "delay"}`
      default:
        return "Acción personalizada"
    }
  }

  const onCreateWorkflow = async (data: WorkflowCreateFormData) => {
    try {
      const response = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description || null,
          trigger_type: data.trigger_type,
          trigger_conditions: {},
          actions: data.actions.map(a => ({ type: a.type, params: a.params })),
          is_active: true
        })
      })

      if (!response.ok) {
        toast.error("Error al crear workflow")
        return
      }

      const result = await response.json()
      setWorkflows([...workflows, {
        id: result.data?.id || crypto.randomUUID(),
        name: data.name,
        description: data.description || "",
        triggerType: data.trigger_type,
        triggerConditions: {},
        actions: data.actions,
        isActive: true,
        executionCount: 0
      }])
      reset({ name: "", description: "", trigger_type: "contact.created", actions: [] })
      setIsCreating(false)
      toast.success("Workflow creado exitosamente")
    } catch {
      toast.error("Error de conexión")
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
          onClick={() => {
            reset({ name: "", description: "", trigger_type: "contact.created", actions: [] })
            setIsCreating(true)
          }}
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
              <form className="space-y-6" onSubmit={handleSubmit(onCreateWorkflow)}>
              {/* Nombre y descripción */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Nombre del Workflow</label>
                  <input
                    type="text"
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Ej: Seguimiento de leads calientes"
                    {...register("name")}
                  />
                  {errors.name?.message && <p className="text-destructive text-sm mt-1">{String(errors.name.message)}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Descripción</label>
                  <textarea
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                    placeholder="Describe qué hace este workflow..."
                    rows={2}
                    {...register("description")}
                  />
                </div>
              </div>

              {/* Trigger - ✅ FIX: Opciones sincronizadas con lib/schemas.ts */}
              <div>
                <label className="text-sm font-medium">Disparador (Trigger)</label>
                <select
                  className="w-full mt-1 px-3 py-2 border rounded-md"
                  {...register("trigger_type")}
                >
                  {WORKFLOW_TRIGGER_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.trigger_type?.message && <p className="text-destructive text-sm mt-1">{String(errors.trigger_type.message)}</p>}
              </div>

              {/* Acciones */}
              <div>
                <label className="text-sm font-medium">Acciones</label>
                <div className="mt-2 space-y-2">
                  {actionsArray.fields.map((action, idx) => (
                    <div key={action.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      {getActionIcon(action.type)}
                      <span className="flex-1 text-sm">{getActionDescription(action as any)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => actionsArray.remove(idx)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
                {errors.actions?.message && <p className="text-destructive text-sm mt-1">{String(errors.actions.message)}</p>}
                <div className="mt-2 flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => actionsArray.append({
                      id: crypto.randomUUID(),
                      type: "send_email",
                      params: { template: "notification", to: "{{contact.email}}" }
                    })}
                  >
                    <Mail className="h-4 w-4 mr-1" /> Email
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => actionsArray.append({
                      id: crypto.randomUUID(),
                      type: "create_task",
                      params: { description: "Seguimiento" }
                    })}
                  >
                    <Settings className="h-4 w-4 mr-1" /> Tarea
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => actionsArray.append({
                      id: crypto.randomUUID(),
                      type: "update_lead_status",
                      params: { status: "warm" }
                    })}
                  >
                    <Zap className="h-4 w-4 mr-1" /> Cambiar Status
                  </Button>
                </div>
              </div>

              {/* Botones */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-cyan-500 to-blue-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creando..." : "Crear Workflow"}
                </Button>
              </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
