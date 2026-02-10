/**
 * Cola de Workflows - Maneja la ejecución asíncrona de workflows
 *
 * Esta cola se encarga de:
 * - Recibir solicitudes de ejecución de workflows
 * - Encolarlos con prioridad
 * - Permitir rastreo del progreso
 */

import { Queue } from 'bullmq'
import { defaultQueueConfig, QUEUE_NAMES, JOB_CONFIGS, ensureRedisAvailable } from './queue-config'
import { logger } from '../logger'
import { kickBackgroundProcessing } from "../realtime-kick"

/**
 * Tipos de datos que se envían a la cola
 */
export interface WorkflowJobData {
  workflowId: string // ID del workflow a ejecutar
  organizationId: string // ID de la organización (multi-tenant)
  contactId?: string // ID del contacto (opcional)
  userId?: string // ID del usuario que lo ejecutó
  payload?: Record<string, any> // Datos adicionales para el workflow
  metadata?: {
    source?: string // De dónde vino (api, cron, manual, etc.)
    triggeredBy?: string // Qué lo disparó (contact.created, manual, etc.)
    priority?: 'high' | 'normal' | 'low' // Prioridad de ejecución
  }
}

/**
 * Resultado que devuelve el worker después de procesar
 */
export interface WorkflowJobResult {
  success: boolean
  workflowId: string
  executionId?: string // ID de workflow_executions en Supabase
  executedActions: number
  failedActions: number
  duration_ms: number
  errors?: string[]
}

/**
 * Singleton: solo creamos UNA instancia de la cola
 * Esto evita crear múltiples conexiones a Redis
 */
let workflowQueueInstance: Queue<WorkflowJobData, WorkflowJobResult> | null = null

/**
 * Obtiene o crea la instancia de la cola de workflows
 */
export function getWorkflowQueue(): Queue<WorkflowJobData, WorkflowJobResult> {
  if (workflowQueueInstance) {
    return workflowQueueInstance
  }

  // Verificar que Redis esté disponible
  ensureRedisAvailable()

  // Crear la cola
  workflowQueueInstance = new Queue<WorkflowJobData, WorkflowJobResult>(
    QUEUE_NAMES.WORKFLOWS,
    defaultQueueConfig
  )

  logger.info('Workflow queue created', { queue: QUEUE_NAMES.WORKFLOWS })

  return workflowQueueInstance
}

/**
 * Agrega un workflow a la cola para ser procesado
 *
 * @param data - Datos del workflow a ejecutar
 * @returns Job creado con su ID para rastreo
 *
 * Ejemplo de uso:
 * ```typescript
 * const job = await addWorkflowJob({
 *   workflowId: 'workflow-uuid',
 *   organizationId: 'org-uuid',
 *   contactId: 'contact-uuid'
 * })
 *
 * logger.info('Job creado', { jobId: job.id })
 * ```
 */
export async function addWorkflowJob(data: WorkflowJobData) {
  const queue = getWorkflowQueue()

  // Determinar prioridad
  const priority = data.metadata?.priority || 'normal'
  const priorityValue = {
    high: 1, // Se procesa primero
    normal: 5,
    low: 10, // Se procesa al final
  }[priority]

  // Agregar a la cola
  const job = await queue.add(
    'execute-workflow', // Nombre del tipo de job
    data,
    {
      ...JOB_CONFIGS.workflow, // Configuración de workflow (reintentos, timeout)
      priority: priorityValue,
      jobId: `workflow-${data.workflowId}-${Date.now()}`, // ID único
    }
  )

  logger.info('Workflow enqueued', { workflowId: data.workflowId, jobId: job.id, priority })

  // Near real-time kick (best-effort). If not configured, cron will drain later.
  await kickBackgroundProcessing("workflow:enqueued")

  return job
}

/**
 * Agrega múltiples workflows a la cola de una vez
 * Más eficiente que agregar uno por uno
 *
 * Caso de uso: "Ejecutar este workflow para 1000 contactos"
 *
 * @param jobs - Array de datos de workflows
 * @returns Array de jobs creados
 *
 * Ejemplo:
 * ```typescript
 * const contacts = [{ id: '1' }, { id: '2' }, { id: '3' }]
 *
 * await addBulkWorkflowJobs(
 *   contacts.map(contact => ({
 *     workflowId: 'welcome-workflow',
 *     organizationId: 'org-123',
 *     contactId: contact.id
 *   }))
 * )
 * ```
 */
export async function addBulkWorkflowJobs(jobs: WorkflowJobData[]) {
  const queue = getWorkflowQueue()

  const bulkJobs = jobs.map((data, index) => ({
    name: 'execute-workflow',
    data,
    opts: {
      ...JOB_CONFIGS.workflow,
      priority: 5, // Normal por defecto en bulk
      jobId: `workflow-${data.workflowId}-bulk-${Date.now()}-${index}`,
    },
  }))

  const createdJobs = await queue.addBulk(bulkJobs)

  logger.info('Workflows enqueued in bulk', { count: createdJobs.length })

  return createdJobs
}

/**
 * Obtiene el estado de un job específico
 *
 * @param jobId - ID del job a consultar
 * @returns Estado del job o null si no existe
 *
 * Ejemplo:
 * ```typescript
 * const status = await getJobStatus('workflow-123-1234567890')
 *
 * if (status?.state === 'completed') {
 *   logger.info('Workflow terminado', { result: status.result })
 * }
 * ```
 */
export async function getJobStatus(jobId: string) {
  const queue = getWorkflowQueue()
  const job = await queue.getJob(jobId)

  if (!job) {
    return null
  }

  const state = await job.getState()
  const progress = job.progress

  return {
    id: job.id,
    state, // 'waiting', 'active', 'completed', 'failed', 'delayed'
    progress, // 0-100 o datos personalizados
    data: job.data,
    result: job.returnvalue, // Resultado si está completado
    failedReason: job.failedReason, // Error si falló
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  }
}

/**
 * Cancela un job que está en cola o ejecutándose
 *
 * @param jobId - ID del job a cancelar
 * @returns true si se canceló, false si no se pudo
 */
export async function cancelJob(jobId: string): Promise<boolean> {
  const queue = getWorkflowQueue()
  const job = await queue.getJob(jobId)

  if (!job) {
    return false
  }

  await job.remove()
  logger.info('Job cancelled', { jobId })

  return true
}

/**
 * Obtiene estadísticas de la cola
 *
 * Útil para dashboards y monitoreo
 */
export async function getQueueStats() {
  const queue = getWorkflowQueue()

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])

  return {
    waiting, // Jobs esperando ser procesados
    active, // Jobs siendo procesados ahora
    completed, // Jobs terminados exitosamente
    failed, // Jobs que fallaron después de todos los reintentos
    delayed, // Jobs programados para el futuro
    total: waiting + active + completed + failed + delayed,
  }
}

/**
 * Limpia jobs antiguos (mantenimiento)
 * Llamar esto periódicamente (ej: via cron job diario)
 */
export async function cleanOldJobs() {
  const queue = getWorkflowQueue()

  // Limpiar jobs completados de más de 24 horas
  await queue.clean(24 * 60 * 60 * 1000, 1000, 'completed')

  // Limpiar jobs fallidos de más de 7 días
  await queue.clean(7 * 24 * 60 * 60 * 1000, 100, 'failed')

  logger.info('Old jobs cleaned')
}

/**
 * Pausa la cola (deja de procesar jobs)
 * Útil para mantenimiento o emergencias
 */
export async function pauseQueue() {
  const queue = getWorkflowQueue()
  await queue.pause()
  logger.info('Workflow queue paused')
}

/**
 * Reanuda la cola
 */
export async function resumeQueue() {
  const queue = getWorkflowQueue()
  await queue.resume()
  logger.info('Workflow queue resumed')
}

/**
 * Cierra la cola (cleanup)
 * Llamar esto cuando la aplicación se cierra
 */
export async function closeQueue() {
  if (workflowQueueInstance) {
    await workflowQueueInstance.close()
    workflowQueueInstance = null
    logger.info('Workflow queue closed')
  }
}

// Exportar la cola para uso directo si es necesario
export const workflowQueue = getWorkflowQueue
