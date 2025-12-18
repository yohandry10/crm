/**
 * Cola de Importaciones - Procesamiento asíncrono de importaciones masivas
 *
 * Casos de uso:
 * - Importar contactos desde CSV/Excel
 * - Importar productos
 * - Importar transacciones
 * - Importar desde APIs externas
 */

import { Queue } from 'bullmq'
import { defaultQueueConfig, QUEUE_NAMES, JOB_CONFIGS } from './queue-config'
import { logger } from '../logger'

export interface ImportJobData {
  type: 'contacts' | 'products' | 'invoices' | 'leads' | 'custom'
  organizationId: string
  userId: string
  source: 'csv' | 'excel' | 'api' | 'integration'
  data: Array<Record<string, any>> // Los datos a importar
  options?: {
    skipDuplicates?: boolean
    updateExisting?: boolean
    validateEmails?: boolean
    batchSize?: number
    mapping?: Record<string, string> // Mapeo de columnas
  }
  metadata?: {
    filename?: string
    totalRows?: number
    source?: string
  }
}

export interface ImportJobResult {
  success: boolean
  imported: number
  skipped: number
  failed: number
  errors: Array<{
    row: number
    error: string
    data?: any
  }>
  duration_ms: number
}

let importQueueInstance: Queue<ImportJobData, ImportJobResult> | null = null

/**
 * Obtiene o crea la cola de importaciones
 */
export function getImportQueue(): Queue<ImportJobData, ImportJobResult> {
  if (importQueueInstance) {
    return importQueueInstance
  }

  importQueueInstance = new Queue<ImportJobData, ImportJobResult>(
    QUEUE_NAMES.IMPORTS,
    defaultQueueConfig
  )

  logger.info('Import queue created', { queue: QUEUE_NAMES.IMPORTS })

  return importQueueInstance
}

/**
 * Encola una importación
 */
export async function importDataAsync(data: ImportJobData) {
  const queue = getImportQueue()

  const job = await queue.add('import-data', data, {
    ...JOB_CONFIGS.import,
    jobId: `import-${data.type}-${Date.now()}`,
  })

  logger.info('Import enqueued', {
    type: data.type,
    count: data.data.length,
    jobId: job.id,
    organizationId: data.organizationId,
    userId: data.userId,
  })

  return job
}

/**
 * Obtiene estadísticas de la cola
 */
export async function getImportQueueStats() {
  const queue = getImportQueue()

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ])

  return {
    waiting,
    active,
    completed,
    failed,
    total: waiting + active + completed + failed,
  }
}
