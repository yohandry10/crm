/**
 * Cola de Emails - Envío asíncrono de emails
 *
 * Casos de uso:
 * - Emails de bienvenida
 * - Notificaciones a usuarios
 * - Reportes por email
 * - Facturas por email
 * - Newsletters
 */

import { Queue } from 'bullmq'
import { defaultQueueConfig, QUEUE_NAMES, JOB_CONFIGS } from './queue-config'
import { logger } from '../logger'

export interface EmailJobData {
  to: string | string[] // Email(s) del destinatario
  subject: string
  html?: string
  text?: string
  template?: 'welcome' | 'invoice' | 'task_assigned' | 'order_completed'
  templateData?: Record<string, any>
  organizationId: string
  attachments?: Array<{
    filename: string
    content?: string
    path?: string
  }>
  metadata?: {
    userId?: string
    source?: string
    priority?: 'high' | 'normal' | 'low'
  }
}

export interface EmailJobResult {
  success: boolean
  messageId?: string
  error?: string
  recipients: string[]
  duration_ms: number
}

let emailQueueInstance: Queue<EmailJobData, EmailJobResult> | null = null

/**
 * Obtiene o crea la cola de emails
 */
export function getEmailQueue(): Queue<EmailJobData, EmailJobResult> {
  if (emailQueueInstance) {
    return emailQueueInstance
  }

  emailQueueInstance = new Queue<EmailJobData, EmailJobResult>(
    QUEUE_NAMES.EMAILS,
    defaultQueueConfig
  )

  logger.info('Email queue created', { queue: QUEUE_NAMES.EMAILS })

  return emailQueueInstance
}

/**
 * Envía un email (lo encola)
 */
export async function sendEmailAsync(data: EmailJobData) {
  const queue = getEmailQueue()

  const priority = data.metadata?.priority || 'normal'
  const priorityValue = {
    high: 1,
    normal: 5,
    low: 10,
  }[priority]

  const job = await queue.add('send-email', data, {
    ...JOB_CONFIGS.email,
    priority: priorityValue,
    jobId: `email-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  })

  logger.info('Email enqueued', {
    jobId: job.id,
    toCount: Array.isArray(data.to) ? data.to.length : 1,
    organizationId: data.organizationId,
    priority,
  })

  return job
}

/**
 * Envía múltiples emails en bulk
 */
export async function sendBulkEmailsAsync(emails: EmailJobData[]) {
  const queue = getEmailQueue()

  const bulkJobs = emails.map((data, index) => ({
    name: 'send-email',
    data,
    opts: {
      ...JOB_CONFIGS.email,
      priority: 5,
      jobId: `email-bulk-${Date.now()}-${index}`,
    },
  }))

  const jobs = await queue.addBulk(bulkJobs)

  logger.info('Emails enqueued in bulk', { count: jobs.length })

  return jobs
}

/**
 * Obtiene estadísticas de la cola de emails
 */
export async function getEmailQueueStats() {
  const queue = getEmailQueue()

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
