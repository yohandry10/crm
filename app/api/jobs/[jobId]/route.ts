/**
 * API Endpoint: Estado de Jobs de BullMQ
 *
 * Permite rastrear el estado de cualquier job encolado:
 * - Workflows
 * - Emails
 * - Importaciones
 * - Webhooks
 *
 * GET /api/jobs/[jobId] - Obtiene el estado del job
 */

import { type NextRequest, NextResponse } from "next/server"
import { getJobStatus } from "@/lib/queues/workflow-queue"
import { getAuthenticatedContext } from "@/lib/supabase-auth"

export async function GET(
    request: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        // Autenticación (para evitar que cualquiera vea el estado de jobs)
        await getAuthenticatedContext()

        const { jobId } = params

        if (!jobId) {
            return NextResponse.json({
                success: false,
                error: "jobId is required"
            }, { status: 400 })
        }

        // Obtener estado del job
        const status = await getJobStatus(jobId)

        if (!status) {
            return NextResponse.json({
                success: false,
                error: "Job not found",
                details: `No se encontró el job con ID: ${jobId}`
            }, { status: 404 })
        }

        // Mapear estados de BullMQ a mensajes amigables
        const stateMessages: Record<string, string> = {
            'waiting': 'En cola, esperando ser procesado',
            'active': 'En proceso de ejecución',
            'completed': 'Completado exitosamente',
            'failed': 'Falló después de todos los reintentos',
            'delayed': 'Programado para ejecutarse más tarde',
            'paused': 'Pausado temporalmente'
        }

        // Determinar si está finalizado
        const isFinished = ['completed', 'failed'].includes(status.state)

        // Preparar respuesta
        const response: any = {
            success: true,
            data: {
                jobId: status.id,
                state: status.state,
                stateMessage: stateMessages[status.state] || 'Estado desconocido',
                isFinished,
                progress: status.progress || 0,
                attemptsMade: status.attemptsMade,
                timestamp: status.timestamp,
                processedOn: status.processedOn,
                finishedOn: status.finishedOn,
            }
        }

        // Agregar duración si está completado
        if (isFinished && status.processedOn && status.finishedOn) {
            response.data.duration_ms = status.finishedOn - status.processedOn
        }

        // Agregar resultado si está completado
        if (status.state === 'completed' && status.result) {
            response.data.result = status.result
        }

        // Agregar error si falló
        if (status.state === 'failed') {
            response.data.error = status.failedReason || 'Error desconocido'
        }

        // Agregar datos originales del job (sin información sensible)
        response.data.jobData = {
            workflowId: status.data.workflowId,
            organizationId: status.data.organizationId,
            contactId: status.data.contactId,
            source: status.data.metadata?.source,
            priority: status.data.metadata?.priority,
        }

        return NextResponse.json(response)

    } catch (error: any) {
        console.error('Error obteniendo estado del job:', error)
        return NextResponse.json({
            success: false,
            error: "Error al obtener estado del job",
            details: error.message
        }, { status: 500 })
    }
}

/**
 * DELETE /api/jobs/[jobId] - Cancela un job
 *
 * Solo permite cancelar jobs que están en estado 'waiting' o 'delayed'
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: { jobId: string } }
) {
    try {
        await getAuthenticatedContext()

        const { jobId } = params

        // Primero verificar que el job existe
        const status = await getJobStatus(jobId)

        if (!status) {
            return NextResponse.json({
                success: false,
                error: "Job not found"
            }, { status: 404 })
        }

        // Solo permitir cancelar jobs que no han empezado
        if (['active', 'completed', 'failed'].includes(status.state)) {
            return NextResponse.json({
                success: false,
                error: "Cannot cancel job in current state",
                details: `El job está en estado '${status.state}' y no puede ser cancelado`
            }, { status: 400 })
        }

        // Cancelar el job
        const { cancelJob } = await import("@/lib/queues/workflow-queue")
        const cancelled = await cancelJob(jobId)

        if (cancelled) {
            return NextResponse.json({
                success: true,
                message: "Job cancelado exitosamente"
            })
        } else {
            return NextResponse.json({
                success: false,
                error: "No se pudo cancelar el job"
            }, { status: 500 })
        }

    } catch (error: any) {
        console.error('Error cancelando job:', error)
        return NextResponse.json({
            success: false,
            error: "Error al cancelar job",
            details: error.message
        }, { status: 500 })
    }
}
