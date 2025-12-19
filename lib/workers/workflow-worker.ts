/**
 * Worker de Workflows - Procesa jobs de la cola de workflows
 *
 * Este worker:
 * - Lee jobs de la cola 'workflows'
 * - Ejecuta las acciones del workflow
 * - Reporta progreso y resultados
 * - Maneja errores y reintentos automáticos
 *
 * IMPORTANTE: Este archivo debe ejecutarse en un proceso separado,
 * no en el servidor Next.js principal.
 */

import { Worker, Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { defaultWorkerConfig, QUEUE_NAMES, ensureRedisAvailable } from '../queues/queue-config'
import type { WorkflowJobData, WorkflowJobResult } from '../queues/workflow-queue'
import { withSpan, addSpanAttributes, addSpanEvent } from '../observability/otel'
import { logger } from '../logger'

/**
 * Ejecuta un workflow completo
 *
 * Esta es la función PRINCIPAL que procesa cada job
 *
 * @param job - El job de BullMQ con los datos del workflow
 * @returns Resultado de la ejecución
 */
async function processWorkflowJob(
  job: Job<WorkflowJobData, WorkflowJobResult>
): Promise<WorkflowJobResult> {
  const { workflowId, organizationId, contactId, userId, payload } = job.data

  logger.info('Processing workflow job', { workflowId, organizationId, contactId, userId, jobId: job.id })

  // Wrap todo el procesamiento en un span de OpenTelemetry
  return withSpan('workflow.process', async (span) => {
    void span
    // Agregar atributos del workflow al span
    addSpanAttributes({
      'workflow.id': workflowId,
      'workflow.organization_id': organizationId,
      'workflow.contact_id': contactId || 'none',
      'workflow.user_id': userId ?? 'none',
      'job.id': job.id ?? 'unknown',
      'job.attempt': job.attemptsMade,
    })

    const startTime = Date.now()

  try {
    // 1. Crear cliente de Supabase con service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role para operaciones del worker
      { auth: { persistSession: false } }
    )

    // 2. Obtener el workflow de la base de datos
    await job.updateProgress(10) // 10% - Obteniendo workflow

    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('organization_id', organizationId)
      .single()

    if (workflowError || !workflow) {
      throw new Error(`Workflow no encontrado: ${workflowId}`)
    }

    // Verificar que el workflow esté activo
    if (!workflow.is_active) {
      throw new Error(`Workflow inactivo: ${workflow.name}`)
    }

    logger.info('Workflow loaded', { workflowId, workflowName: workflow.name, actions: workflow.actions?.length || 0 })

    // 3. Crear registro de ejecución
    const { data: execution, error: executionError } = await supabase
      .from('workflow_executions')
      .insert({
        workflow_id: workflowId,
        organization_id: organizationId,
        contact_id: contactId || null,
        triggered_by: userId || null,
        status: 'running',
        started_at: new Date().toISOString(),
        metadata: {
          jobId: job.id,
          source: job.data.metadata?.source || 'manual',
          ...payload,
        },
      })
      .select('id')
      .single()

    if (executionError || !execution) {
      throw new Error('Error creando registro de ejecución')
    }

    const executionId = execution.id

    // 4. Ejecutar las acciones del workflow
    const actions = workflow.actions || []
    const executedActions: any[] = []
    const errors: string[] = []

    for (let i = 0; i < actions.length; i++) {
      const action = actions[i]
      const progress = 20 + (i / actions.length) * 70 // 20% a 90%

      await job.updateProgress(progress)

      logger.debug('Executing workflow action', {
        workflowId,
        executionId,
        actionIndex: i,
        actionType: action.type,
        totalActions: actions.length,
      })

      try {
        // Importar dinámicamente el executor (evita imports circulares)
        const { executeAction } = await import('../workflow-executor')

        const result = await executeAction(supabase, action, {
          organizationId,
          contactId,
          userId,
          payload: {
            ...payload,
            workflow: workflow,
          },
        })

        executedActions.push({
          action: action.type,
          success: result.success,
          result: result.result,
          error: result.error,
          duration_ms: result.duration_ms,
        })

        // Si la acción falló, registrar error pero continuar
        if (!result.success) {
          errors.push(`${action.type}: ${result.error}`)
          logger.warn('Workflow action failed', {
            workflowId,
            executionId,
            actionIndex: i,
            actionType: action.type,
            error: result.error,
          })
        } else {
          logger.debug('Workflow action succeeded', {
            workflowId,
            executionId,
            actionIndex: i,
            actionType: action.type,
          })
        }
      } catch (actionError: any) {
        const errorMsg = `${action.type}: ${actionError.message}`
        errors.push(errorMsg)
        logger.error('Workflow action threw', actionError, {
          workflowId,
          executionId,
          actionIndex: i,
          actionType: action.type,
        })

        executedActions.push({
          action: action.type,
          success: false,
          error: actionError.message,
        })
      }
    }

    // 5. Actualizar registro de ejecución
    const finalStatus = errors.length === 0 ? 'completed' : errors.length < actions.length ? 'partial' : 'failed'

    await supabase
      .from('workflow_executions')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        actions_executed: executedActions.length,
        actions_failed: errors.length,
        execution_log: executedActions,
        error_log: errors.length > 0 ? errors : null,
      })
      .eq('id', executionId)

    // 6. Resultado final
    await job.updateProgress(100)

    const duration_ms = Date.now() - startTime
    const result: WorkflowJobResult = {
      success: errors.length === 0,
      workflowId,
      executionId,
      executedActions: executedActions.length,
      failedActions: errors.length,
      duration_ms,
      errors: errors.length > 0 ? errors : undefined,
    }

    logger.info('Workflow job completed', {
      workflowId,
      executionId,
      success: result.success,
      duration_ms,
      executedActions: result.executedActions,
      failedActions: result.failedActions,
    })

    // Agregar métricas finales al span
    addSpanAttributes({
      'workflow.executed_actions': result.executedActions,
      'workflow.failed_actions': result.failedActions,
      'workflow.duration_ms': duration_ms,
      'workflow.success': result.success,
    })

    addSpanEvent('workflow.completed', {
      executedActions: result.executedActions,
      failedActions: result.failedActions,
    })

    return result
  } catch (error: any) {
    // Error fatal que impide procesar el workflow
    const duration_ms = Date.now() - startTime

    logger.error('Fatal workflow job error', error, { workflowId, organizationId, contactId, userId, duration_ms, jobId: job.id })

    // Intentar actualizar el registro de ejecución con el error
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      )

      // Buscar la ejecución por jobId en metadata
      const { data: executions } = await supabase
        .from('workflow_executions')
        .select('id')
        .eq('workflow_id', workflowId)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (executions && executions[0]) {
        await supabase
          .from('workflow_executions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_log: [error.message],
          })
          .eq('id', executions[0].id)
      }
    } catch (updateError) {
      logger.error('Failed updating workflow execution record after fatal error', updateError, { workflowId, organizationId })
    }

    // Lanzar el error para que BullMQ lo maneje (reintentos)
    throw error
  }

  })
}

/**
 * Crea y inicia el worker de workflows
 *
 * Este worker procesa jobs de la cola 'workflows'
 */
export function createWorkflowWorker() {
  // Verificar que Redis esté disponible
  ensureRedisAvailable()

  const worker = new Worker<WorkflowJobData, WorkflowJobResult>(
    QUEUE_NAMES.WORKFLOWS,
    processWorkflowJob,
    {
      ...defaultWorkerConfig,
      // Puedes sobrescribir configuraciones específicas aquí
      concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    }
  )

  // Event listeners para debugging y monitoreo

  worker.on('ready', () => {
    logger.info('Workflow worker ready')
  })

  worker.on('active', (job) => {
    logger.info('Workflow job active', { jobId: job.id })
  })

  worker.on('completed', (job, result) => {
    logger.info('Workflow job completed', {
      jobId: job.id,
      success: result.success,
      executedActions: result.executedActions,
      failedActions: result.failedActions,
      duration_ms: result.duration_ms,
      workflowId: result.workflowId,
      executionId: result.executionId,
    })
  })

  worker.on('failed', (job, error) => {
    if (job) {
      logger.error('Workflow job failed', error, {
        jobId: job.id,
        attemptsMade: job.attemptsMade,
        attempts: job.opts.attempts,
      })

      // Si es el último intento, loguear
      if (job.attemptsMade >= (job.opts.attempts || 1)) {
        logger.error('Workflow job exhausted retries', error, { jobId: job.id })
      }
    } else {
      logger.error('Unknown workflow job failed', error)
    }
  })

  worker.on('error', (error) => {
    logger.error('Workflow worker error', error)
  })

  worker.on('stalled', (jobId) => {
    logger.warn('Workflow job stalled', { jobId })
  })

  // Cleanup graceful al cerrar
  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing workflow worker')
    await worker.close()
    logger.info('Workflow worker closed')
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing workflow worker')
    await worker.close()
    logger.info('Workflow worker closed')
    process.exit(0)
  })

  return worker
}

/**
 * Si este archivo se ejecuta directamente (no es importado),
 * iniciar el worker
 *
 * Ejecutar con: node --loader ts-node/esm lib/workers/workflow-worker.ts
 * O: tsx lib/workers/workflow-worker.ts
 */
if (require.main === module) {
  logger.info('Starting workflow worker')

  // Verificar variables de entorno
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    logger.error('Missing Supabase env vars for workflow worker')
    process.exit(1)
  }

  createWorkflowWorker()
  logger.info('Workflow worker running. Press Ctrl+C to stop.')
}
