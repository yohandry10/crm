/**
 * Worker de Emails - Procesa envíos de emails en background
 */

import { Worker, Job } from 'bullmq'
import { defaultWorkerConfig, QUEUE_NAMES } from '../queues/queue-config'
import type { EmailJobData, EmailJobResult } from '../queues/email-queue'
import { logger } from '../logger'

async function processEmailJob(
  job: Job<EmailJobData, EmailJobResult>
): Promise<EmailJobResult> {
  const { to, subject, html, text, template, templateData, attachments } =
    job.data

  logger.info('Processing email job', {
    jobId: job.id,
    toCount: Array.isArray(to) ? to.length : 1,
    template,
  })

  const startTime = Date.now()

  try {
    // Importar la función de envío de emails
    const { sendEmail, getEmailTemplate } = await import('../email')

    // Determinar contenido del email
    let emailContent: { subject: string; html: string }

    if (template && templateData) {
      // Usar template
      emailContent = getEmailTemplate(template, templateData)
    } else {
      // Usar contenido directo
      emailContent = {
        subject,
        html: html || text || '',
      }
    }

    // Enviar email
    const result = await sendEmail({
      to: Array.isArray(to) ? to.join(',') : to,
      subject: emailContent.subject,
      html: emailContent.html,
      // attachments, // Descomentar cuando se implemente soporte de attachments
    })

    if (!result.success) {
      throw new Error(result.error || 'Error al enviar email')
    }

    const duration_ms = Date.now() - startTime

    logger.info('Email sent', { jobId: job.id, duration_ms, messageId: result.id })

    return {
      success: true,
      messageId: result.id,
      recipients: Array.isArray(to) ? to : [to],
      duration_ms,
    }
  } catch (error: any) {
    const duration_ms = Date.now() - startTime

    logger.error('Error sending email', error, { jobId: job.id, duration_ms })

    throw error // BullMQ lo reintentará automáticamente
  }
}

export function createEmailWorker() {
  const worker = new Worker<EmailJobData, EmailJobResult>(
    QUEUE_NAMES.EMAILS,
    processEmailJob,
    {
      ...defaultWorkerConfig,
      concurrency: 10, // Más concurrencia para emails (son rápidos)
    }
  )

  worker.on('ready', () => {
    logger.info('Email worker ready')
  })

  worker.on('completed', (job, result) => {
    logger.info('Email job completed', { jobId: job.id, recipients: result.recipients.length })
  })

  worker.on('failed', (job, error) => {
    if (job) {
      logger.error('Email job failed', error, { jobId: job.id, attemptsMade: job.attemptsMade, attempts: job.opts.attempts })
    }
  })

  return worker
}

if (require.main === module) {
  logger.info('Starting email worker')
  createEmailWorker()
  logger.info('Email worker running. Press Ctrl+C to stop.')
}
