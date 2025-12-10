import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { evaluateWorkflowConditions } from "@/lib/workflow-conditions"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

export async function POST(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()

        const { workflow_id, contact_id, event_data = {}, manual_trigger = false } = await request.json()

        if (!workflow_id) {
            return NextResponse.json({
                success: false,
                error: "workflow_id is required"
            }, { status: 400 })
        }

        // Get workflow - MULTI-TENANT: Validar que pertenece a la organización
        const { data: workflow, error: workflowError } = await supabase
            .from("workflows")
            .select("*")
            .eq("id", workflow_id)
            .eq("organization_id", organizationId)
            .single()

        if (workflowError || !workflow) {
            return NextResponse.json({
                success: false,
                error: "Workflow not found or access denied"
            }, { status: 404 })
        }

        if (!workflow.is_active && !manual_trigger) {
            return NextResponse.json({
                success: false,
                error: "Workflow is not active"
            }, { status: 400 })
        }

        // ✅ FIX ERROR-LOGIC-005: Evaluate trigger conditions
        const conditionsMet = evaluateWorkflowConditions(workflow.trigger_conditions, event_data)

        if (!conditionsMet) {
            return NextResponse.json({
                success: false,
                error: "Workflow conditions not met",
                trigger_conditions: workflow.trigger_conditions,
                event_data
            }, { status: 400 })
        }

        // Execute workflow actions with detailed logging
        const executedActions = []
        const errors = []
        let actionIndex = 0

        // Create execution record first - ✅ FIX WF-003: Incluir organization_id
        const { data: execution, error: execError } = await supabase
            .from("workflow_executions")
            .insert({
                organization_id: organizationId,
                workflow_id,
                contact_id,
                status: 'running',
                executed_actions: [],
                error_message: null
            })
            .select()
            .single()

        if (execError) throw execError

        for (const action of workflow.actions as any[]) {
            let logId: string | null = null

            try {
                // Log action start - ✅ FIX WF-002: Agregar p_org_id
                const { data: startLog } = await supabase.rpc('log_workflow_action_start', {
                    p_org_id: organizationId,
                    p_execution_id: execution.id,
                    p_action_type: action.type,
                    p_action_index: actionIndex,
                    p_input_params: action.params || {}
                })
                logId = startLog

                // Execute action - pass organizationId for multi-tenant
                const actionWithOrg = { ...action, params: { ...action.params, organization_id: organizationId } }
                const result = await executeAction(supabase, actionWithOrg, contact_id, user.id)

                // Log action success
                if (logId) {
                    await supabase.rpc('log_workflow_action_complete', {
                        p_log_id: logId,
                        p_status: 'success',
                        p_output_result: result || {}
                    })
                }

                executedActions.push({
                    action: action.type,
                    success: true,
                    result
                })
            } catch (error: any) {
                // Log action failure
                if (logId) {
                    await supabase.rpc('log_workflow_action_complete', {
                        p_log_id: logId,
                        p_status: 'failed',
                        p_error_message: error.message,
                        p_error_stack: error.stack || null
                    })
                }

                errors.push({
                    action: action.type,
                    error: error.message
                })
            }

            actionIndex++
        }

        // Update execution status
        await supabase
            .from("workflow_executions")
            .update({
                status: errors.length > 0 ? 'failed' : 'success',
                executed_actions: executedActions,
                error_message: errors.length > 0 ? JSON.stringify(errors) : null
            })
            .eq('id', execution.id)

        return NextResponse.json({
            success: true,
            data: execution,
            executed_actions: executedActions,
            errors: errors.length > 0 ? errors : undefined
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/workflows/execute",
            method: "POST",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

async function executeAction(supabase: any, action: any, contact_id: string, user_id: string): Promise<any> {
    switch (action.type) {
        case 'send_email':
            // ✅ Implementación real con Resend
            const { sendEmail } = await import('@/lib/email')

            const emailResult = await sendEmail({
                to: action.params.to,
                subject: action.params.subject,
                html: action.params.html || action.params.body || action.params.text || ''
            })

            if (!emailResult.success) {
                throw new Error(`Email failed: ${emailResult.error}`)
            }

            return {
                sent: true,
                to: action.params.to,
                messageId: emailResult.id
            }

        case 'update_lead_score':
            if (!contact_id) throw new Error('contact_id required for update_lead_score')
            const { error: scoreError } = await supabase
                .from('contacts')
                .update({ lead_score: action.params.score })
                .eq('id', contact_id)
            if (scoreError) throw scoreError
            return { updated: true, score: action.params.score }

        case 'update_lead_status':
            if (!contact_id) throw new Error('contact_id required for update_lead_status')
            const { error: statusError } = await supabase
                .from('contacts')
                .update({ lead_status: action.params.status })
                .eq('id', contact_id)
            if (statusError) throw statusError
            return { updated: true, status: action.params.status }

        case 'create_task':
            if (!contact_id) throw new Error('contact_id required for create_task')

            // Note: organization_id must be passed from the caller context
            const { data: task, error: taskError } = await supabase
                .from('tasks')
                .insert({
                    organization_id: action.params.organization_id,
                    assigned_to: user_id,
                    contact_id,
                    title: action.params.title,
                    description: action.params.description || null,
                    priority: action.params.priority || 'medium',
                    due_date: action.params.due_date || null,
                    status: 'pending'
                })
                .select()
                .single()

            if (taskError) throw taskError

            return { created: true, task_id: task.id, title: task.title }

        case 'webhook':
            // Call external webhook
            const response = await fetch(action.params.url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action.params.payload || {})
            })
            return { sent: true, status: response.status }

        default:
            throw new Error(`Unknown action type: ${action.type}`)
    }
}
