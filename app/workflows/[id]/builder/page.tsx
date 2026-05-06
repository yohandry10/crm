"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { WorkflowBuilder } from "@/components/workflows/workflow-builder"
import { Loader2, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import DashboardLayout from "@/components/layout/dashboard-layout"

export default function WorkflowBuilderPage() {
    const params = useParams()
    const router = useRouter()
    const workflowId = params?.id as string

    const [loading, setLoading] = useState(true)
    const [workflow, setWorkflow] = useState<any>(null)

    useEffect(() => {
        const fetchWorkflow = async () => {
            const supabase = getSupabaseBrowserClient()
            try {
                const { data, error } = await supabase
                    .from('workflows')
                    .select('*')
                    .eq('id', workflowId)
                    .single()

                if (error) throw error
                setWorkflow(data)
            } catch (error) {
                console.error("Error fetching workflow:", error)
                toast.error("Error al cargar el workflow")
            } finally {
                setLoading(false)
            }
        }

        if (workflowId) fetchWorkflow()
    }, [workflowId])

    const handleSave = async (nodes: any[], edges: any[]) => {
        const supabase = getSupabaseBrowserClient()
        try {
            const definition = { nodes, edges }
            const compiled = compileGraphToLinearActions(nodes, edges)

            const { error } = await supabase
                .from('workflows')
                .update({
                    definition,
                    trigger_type: compiled.triggerType,
                    actions: compiled.actions,
                    updated_at: new Date().toISOString()
                })
                .eq('id', workflowId)

            if (error) throw error
            toast.success("Workflow guardado correctamente")

        } catch (error: any) {
            console.error("Error saving workflow:", error)
            toast.error(error?.message || "Error al guardar")
        }
    }

    if (loading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center h-[80vh]">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            </DashboardLayout>
        )
    }

    return (
        <DashboardLayout>
            <div className="space-y-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{workflow?.name || 'Workflow Builder'}</h1>
                        <p className="text-muted-foreground text-sm">Diseña tu automatización visualmente</p>
                    </div>
                </div>

                <WorkflowBuilder
                    initialNodes={workflow?.definition?.nodes || []}
                    initialEdges={workflow?.definition?.edges || []}
                    onSave={handleSave}
                />
            </div>
        </DashboardLayout>
    )
}

function compileGraphToLinearActions(nodes: any[], edges: any[]) {
    const actions: any[] = []

    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (!triggerNode) {
        throw new Error("Agrega un disparador antes de guardar")
    }

    const triggerType = triggerNode.data?.eventType
    if (!triggerType) {
        throw new Error("Configura el evento del disparador antes de guardar")
    }

    let currentNode = triggerNode
    const visited = new Set()

    while (currentNode) {
        if (visited.has(currentNode.id)) break
        visited.add(currentNode.id)

        if (currentNode.type === 'action') {
            const actionType = currentNode.data?.actionType
            const params = currentNode.data?.params || {}
            validateActionParams(actionType, params)

            actions.push({
                type: actionType,
                params,
            })
        }

        const edge = edges.find(e => e.source === currentNode.id)
        if (!edge) break

        const nextNode = nodes.find(n => n.id === edge.target)
        currentNode = nextNode
    }

    if (actions.length === 0) {
        throw new Error("Conecta al menos una acción configurada al disparador")
    }

    return { triggerType, actions }
}

function validateActionParams(actionType: string, params: Record<string, any>) {
    if (!actionType) {
        throw new Error("Configura el tipo de acción")
    }

    switch (actionType) {
        case "send_email":
            if (!params.subject?.trim()) throw new Error("El email necesita asunto")
            if (!params.body?.trim() && !params.template?.trim()) {
                throw new Error("El email necesita contenido o plantilla")
            }
            return
        case "create_task":
            if (!params.title?.trim()) throw new Error("La tarea necesita título")
            if (params.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(params.due_date)) {
                throw new Error("La fecha límite de la tarea no es válida")
            }
            return
        case "update_lead_score": {
            const score = Number(params.score)
            if (!Number.isFinite(score) || score < 0 || score > 100) {
                throw new Error("El score debe estar entre 0 y 100")
            }
            return
        }
        case "update_lead_status":
            if (!["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"].includes(params.status)) {
                throw new Error("Selecciona un estado válido para el lead")
            }
            return
        case "webhook":
            try {
                new URL(params.url)
            } catch {
                throw new Error("El webhook necesita una URL válida")
            }
            if (params.method && !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(params.method)) {
                throw new Error("El método HTTP del webhook no es válido")
            }
            return
        default:
            throw new Error(`Acción no soportada: ${actionType}`)
    }
}
