/**
 * Worker de Importaciones - Procesa importaciones masivas en background
 */

import { Worker, Job } from 'bullmq'
import { createClient } from '@supabase/supabase-js'
import { defaultWorkerConfig, QUEUE_NAMES } from '../queues/queue-config'
import type { ImportJobData, ImportJobResult } from '../queues/import-queue'
import { logger } from '../logger'

async function processImportJob(
  job: Job<ImportJobData, ImportJobResult>
): Promise<ImportJobResult> {
  const { type, organizationId, userId, data, options } = job.data

  logger.info('Processing import job', { jobId: job.id, type, count: data.length, organizationId, userId })

  const startTime = Date.now()
  const errors: Array<{ row: number; error: string; data?: any }> = []
  let imported = 0
  let skipped = 0

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )

    // Determinar tabla según tipo
    const tableMap = {
      contacts: 'contacts',
      products: 'products',
      invoices: 'invoices',
      leads: 'contacts', // Los leads son contactos
      custom: type, // Usar el tipo como nombre de tabla
    }

    const tableName = tableMap[type] || type

    // Procesar en lotes (batch)
    const batchSize = options?.batchSize || 100
    const totalBatches = Math.ceil(data.length / batchSize)

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const start = batchIndex * batchSize
      const end = Math.min(start + batchSize, data.length)
      const batch = data.slice(start, end)

      // Actualizar progreso
      const progress = Math.round(((batchIndex + 1) / totalBatches) * 100)
      await job.updateProgress(progress)

      logger.debug('Processing import batch', { jobId: job.id, batchIndex: batchIndex + 1, totalBatches, batchSize: batch.length })

      // Procesar cada registro del lote
      for (let i = 0; i < batch.length; i++) {
        const rowIndex = start + i
        const row = batch[i]

        try {
          // Aplicar mapeo de columnas si existe
          let mappedRow: Record<string, any> = { ...row }
          if (options?.mapping) {
            mappedRow = {}
            Object.keys(options.mapping).forEach((sourceCol) => {
              const targetCol = options.mapping![sourceCol]
              mappedRow[targetCol] = row[sourceCol]
            })
          }

          // Agregar campos obligatorios
          const recordToInsert: Record<string, any> = {
            ...mappedRow,
            organization_id: organizationId,
            created_by: userId,
          }

          // Verificar duplicados si está habilitado
          if (options?.skipDuplicates && type === 'contacts') {
            const email = typeof recordToInsert.email === 'string' ? recordToInsert.email : null
            if (!email) {
              // Sin email no se puede deduplicar por este campo
              // Continuamos y dejamos que la DB/validación maneje el caso.
            } else {
            const { data: existing } = await supabase
              .from(tableName)
              .select('id')
              .eq('organization_id', organizationId)
              .eq('email', email)
              .single()

            if (existing) {
              skipped++
              continue
            }
            }
          }

          // Insertar o actualizar
          if (options?.updateExisting) {
            // Upsert
            const { error } = await supabase
              .from(tableName)
              .upsert(recordToInsert)

            if (error) throw error
          } else {
            // Insert
            const { error } = await supabase
              .from(tableName)
              .insert(recordToInsert)

            if (error) throw error
          }

          imported++
        } catch (rowError: any) {
          errors.push({
            row: rowIndex + 2, // +2 porque Excel empieza en 1 y tiene header
            error: rowError.message,
            data: row,
          })
          logger.warn('Import row failed', { jobId: job.id, row: rowIndex + 2, error: rowError.message })
        }
      }

      // Pequeña pausa entre lotes para no saturar la DB
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    const duration_ms = Date.now() - startTime

    logger.info('Import completed', { jobId: job.id, imported, skipped, failed: errors.length, duration_ms })

    return {
      success: true,
      imported,
      skipped,
      failed: errors.length,
      errors: errors.slice(0, 100), // Limitar a 100 errores para no saturar
      duration_ms,
    }
  } catch (error: any) {
    logger.error('Import job failed', error, { jobId: job.id, type, organizationId })
    throw error
  }
}

export function createImportWorker() {
  const worker = new Worker<ImportJobData, ImportJobResult>(
    QUEUE_NAMES.IMPORTS,
    processImportJob,
    {
      ...defaultWorkerConfig,
      concurrency: 2, // Poca concurrencia (importaciones son pesadas)
    }
  )

  worker.on('ready', () => {
    logger.info('Import worker ready')
  })

  worker.on('completed', (job, result) => {
    logger.info('Import job completed', { jobId: job.id, imported: result.imported, failed: result.failed })
  })

  worker.on('failed', (job, error) => {
    if (job) {
      logger.error('Import job failed', error, { jobId: job.id })
    }
  })

  worker.on('progress', (job, progress) => {
    logger.debug('Import job progress', { jobId: job.id, progress })
  })

  return worker
}

if (require.main === module) {
  logger.info('Starting import worker')
  createImportWorker()
  logger.info('Import worker running. Press Ctrl+C to stop.')
}
