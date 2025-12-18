/**
 * Bull Board - Dashboard visual para monitorear colas de BullMQ
 *
 * Permite ver:
 * - Jobs en cola (waiting, active, completed, failed)
 * - Reintentar jobs fallidos
 * - Limpiar colas
 * - Ver detalles de cada job
 *
 * Acceso: /admin/queues
 */

import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { getWorkflowQueue } from './workflow-queue'
import { getEmailQueue } from './email-queue'
import { getImportQueue } from './import-queue'

let bullBoardInstance: ReturnType<typeof createBullBoard> | null = null

/**
 * Crea o retorna la instancia de Bull Board
 */
export function getBullBoard() {
  if (bullBoardInstance) {
    return bullBoardInstance
  }

  // Obtener todas las colas que queremos monitorear
  const workflowQueue = getWorkflowQueue()
  const emailQueue = getEmailQueue()
  const importQueue = getImportQueue()

  const noOpServerAdapter = {
    setQueues() {
      return this
    },
    setViewsPath() {
      return this
    },
    setStaticPath() {
      return this
    },
    setEntryRoute() {
      return this
    },
    setErrorHandler() {
      return this
    },
    setApiRoutes() {
      return this
    },
    setUIConfig() {
      return this
    },
  } as any

  // Crear Bull Board
  bullBoardInstance = createBullBoard({
    queues: [
      new BullMQAdapter(workflowQueue),
      new BullMQAdapter(emailQueue),
      new BullMQAdapter(importQueue),
    ],
    serverAdapter: noOpServerAdapter, // La UI se sirve manualmente en la ruta Next.js
  })

  return bullBoardInstance
}

/**
 * Agrega una nueva cola al dashboard
 */
export function addQueueToBoard(queue: any) {
  const board = getBullBoard()
  board.addQueue(new BullMQAdapter(queue))
}
