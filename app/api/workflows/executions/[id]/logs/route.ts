import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

interface Params {
    id: string
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<Params> }
) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id: execution_id } = await context.params

        // Get detailed logs for this execution
        const { data: logs, error: logsError } = await supabase
            .rpc('get_workflow_execution_logs', { p_execution_id: execution_id })

        if (logsError) throw logsError

        // Get execution summary - MULTI-TENANT: verify via workflow's organization
        const { data: execution, error: execError } = await supabase
            .from('workflow_executions')
            .select(`
                *,
                workflow:workflows(name, description, organization_id)
            `)
            .eq('id', execution_id)
            .single()

        if (execError) throw execError

        // Verify organization owns this workflow
        if (execution.workflow.organization_id !== organizationId) {
            return NextResponse.json({
                success: false,
                error: "Unauthorized"
            }, { status: 403 })
        }

        return NextResponse.json({
            success: true,
            data: {
                execution,
                logs: logs || [],
                summary: {
                    total_actions: logs?.length || 0,
                    successful: logs?.filter((l: any) => l.status === 'success').length || 0,
                    failed: logs?.filter((l: any) => l.status === 'failed').length || 0,
                    total_duration_ms: logs?.reduce((sum: number, l: any) => sum + (l.duration_ms || 0), 0) || 0
                }
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/workflows/executions/[id]/logs",
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
