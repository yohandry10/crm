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

            // Basic Compilation to Linear Actions (for backward compatibility for now)
            // Finds the Trigger Node -> Follows Edges -> Builds Actions List
            // This is a naive compiler for linear flows. 
            // Real graph execution will require updating lib/events.ts to read 'definition' directly.
            const actions = compileGraphToLinearActions(nodes, edges)

            const { error } = await supabase
                .from('workflows')
                .update({
                    definition,
                    actions, // Update execution plan
                    updated_at: new Date().toISOString()
                })
                .eq('id', workflowId)

            if (error) throw error
            toast.success("Workflow guardado correctamente")

        } catch (error) {
            console.error("Error saving workflow:", error)
            toast.error("Error al guardar")
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

// Naive Compiler: Convert Graph to Linear Actions List
function compileGraphToLinearActions(nodes: any[], edges: any[]) {
    const actions: any[] = []

    // 1. Find Trigger Node
    const triggerNode = nodes.find(n => n.type === 'trigger')
    if (!triggerNode) return []

    // 2. Traverse
    let currentNode = triggerNode
    const visited = new Set()

    while (currentNode) {
        if (visited.has(currentNode.id)) break
        visited.add(currentNode.id)

        // If it's an action node, add to list
        if (currentNode.type === 'action') {
            actions.push({
                type: currentNode.data.actionType,
                params: {
                    // In a real builder, these would come from Node configuration forms (Dialogs)
                    // For now, we mock/pass default params or what's in data
                    ...currentNode.data.params
                }
            })
        }

        // Find next node
        const edge = edges.find(e => e.source === currentNode.id)
        if (!edge) break

        const nextNode = nodes.find(n => n.id === edge.target)
        currentNode = nextNode
    }

    return actions
}
