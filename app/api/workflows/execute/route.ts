/**
 * API Endpoint: Ejecutar Workflow
 *
 * MEJORADO CON BULLMQ:
 * - Ahora ENCOLA el workflow en vez de ejecutarlo síncronamente
 * - Respuesta inmediata al usuario (< 100ms)
 * - Ejecución en background con reintentos automáticos
 * - El usuario puede rastrear el progreso con el jobId
 */

import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { evaluateWorkflowConditions } from "@/lib/workflow-conditions"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { addWorkflowJob } from "@/lib/queues/workflow-queue"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()

        const { workflow_id, contact_id, event_data = {}, manual_trigger = false, priority } = await request.json()

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

        // Evaluate trigger conditions
        const conditionsMet = evaluateWorkflowConditions(workflow.trigger_conditions, event_data)

        if (!conditionsMet) {
            return NextResponse.json({
                success: false,
                error: "Workflow conditions not met",
                trigger_conditions: workflow.trigger_conditions,
                event_data
            }, { status: 400 })
        }

        // ✅ NUEVO: Encolar en vez de ejecutar síncronamente
        const job = await addWorkflowJob({
            workflowId: workflow_id,
            organizationId,
            contactId: contact_id,
            userId: user.id,
            payload: event_data,
            metadata: {
                source: manual_trigger ? 'manual' : 'api',
                triggeredBy: manual_trigger ? user.id : 'system',
                priority: priority || 'normal'
            }
        })

        // ✅ RESPUESTA INMEDIATA (no espera ejecución)
        return NextResponse.json({
            success: true,
            message: "Workflow encolado exitosamente",
            data: {
                jobId: job.id,
                workflowId: workflow_id,
                workflowName: workflow.name,
                status: 'queued',
                estimatedTime: `${(workflow.actions?.length || 0) * 2}s`,
                // URL para rastrear estado
                statusUrl: `/api/jobs/${job.id}/status`
            }
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
