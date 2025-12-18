/**
 * Hook: useJobStatus
 *
 * Hook personalizado para rastrear el estado de jobs de BullMQ
 *
 * Características:
 * - Polling automático cada X segundos
 * - Se detiene cuando el job termina
 * - Maneja errores
 * - Cleanup automático
 *
 * Uso:
 * ```tsx
 * const { status, isLoading, error } = useJobStatus('job-123')
 *
 * if (status?.state === 'completed') {
 *   toast.success('Workflow completado!')
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react'

export interface JobStatus {
  jobId: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused'
  stateMessage: string
  isFinished: boolean
  progress: number
  attemptsMade: number
  timestamp?: number
  processedOn?: number
  finishedOn?: number
  duration_ms?: number
  result?: any
  error?: string
  jobData?: {
    workflowId?: string
    organizationId?: string
    contactId?: string
    source?: string
    priority?: string
  }
}

interface UseJobStatusOptions {
  /** Intervalo de polling en milisegundos (default: 2000) */
  pollInterval?: number
  /** Auto-iniciar polling (default: true) */
  enabled?: boolean
  /** Callback cuando el job se completa */
  onComplete?: (result: any) => void
  /** Callback cuando el job falla */
  onError?: (error: string) => void
  /** Callback en cada actualización */
  onUpdate?: (status: JobStatus) => void
}

export function useJobStatus(
  jobId: string | null,
  options: UseJobStatusOptions = {}
) {
  const {
    pollInterval = 2000,
    enabled = true,
    onComplete,
    onError,
    onUpdate,
  } = options

  const [status, setStatus] = useState<JobStatus | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Función para obtener el estado del job
   */
  const fetchStatus = useCallback(async () => {
    if (!jobId) return

    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch(`/api/jobs/${jobId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al obtener estado del job')
      }

      const newStatus = data.data as JobStatus
      setStatus(newStatus)

      // Callbacks
      if (onUpdate) {
        onUpdate(newStatus)
      }

      if (newStatus.state === 'completed' && onComplete) {
        onComplete(newStatus.result)
      }

      if (newStatus.state === 'failed' && onError) {
        onError(newStatus.error || 'Job falló')
      }
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching job status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [jobId, onComplete, onError, onUpdate])

  /**
   * Efecto para polling automático
   */
  useEffect(() => {
    if (!jobId || !enabled) {
      return
    }

    // Fetch inicial
    fetchStatus()

    // Si ya está finalizado, no hacer polling
    if (status?.isFinished) {
      return
    }

    // Configurar polling
    const interval = setInterval(() => {
      fetchStatus()
    }, pollInterval)

    // Cleanup
    return () => {
      clearInterval(interval)
    }
  }, [jobId, enabled, pollInterval, fetchStatus, status?.isFinished])

  /**
   * Función para refrescar manualmente
   */
  const refresh = useCallback(() => {
    fetchStatus()
  }, [fetchStatus])

  /**
   * Función para cancelar el job
   */
  const cancel = useCallback(async () => {
    if (!jobId) return

    try {
      const response = await fetch(`/api/jobs/${jobId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al cancelar job')
      }

      // Refrescar estado
      await fetchStatus()

      return true
    } catch (err: any) {
      setError(err.message)
      console.error('Error canceling job:', err)
      return false
    }
  }, [jobId, fetchStatus])

  return {
    status,
    isLoading,
    error,
    refresh,
    cancel,
    // Helpers
    isWaiting: status?.state === 'waiting',
    isActive: status?.state === 'active',
    isCompleted: status?.state === 'completed',
    isFailed: status?.state === 'failed',
    isFinished: status?.isFinished || false,
    progress: status?.progress || 0,
  }
}

/**
 * Hook para rastrear múltiples jobs
 *
 * Útil para mostrar una lista de jobs en ejecución
 */
export function useMultipleJobStatus(
  jobIds: string[],
  options: UseJobStatusOptions = {}
) {
  const [statuses, setStatuses] = useState<Record<string, JobStatus>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAllStatuses = useCallback(async () => {
    if (jobIds.length === 0) return

    try {
      setIsLoading(true)
      setError(null)

      // Fetch todos en paralelo
      const promises = jobIds.map((jobId) =>
        fetch(`/api/jobs/${jobId}`).then((res) => res.json())
      )

      const results = await Promise.all(promises)

      const newStatuses: Record<string, JobStatus> = {}
      results.forEach((result, index) => {
        if (result.success) {
          newStatuses[jobIds[index]] = result.data
        }
      })

      setStatuses(newStatuses)
    } catch (err: any) {
      setError(err.message)
      console.error('Error fetching multiple job statuses:', err)
    } finally {
      setIsLoading(false)
    }
  }, [jobIds])

  useEffect(() => {
    if (jobIds.length === 0 || !options.enabled) return

    fetchAllStatuses()

    // Polling
    const interval = setInterval(
      fetchAllStatuses,
      options.pollInterval || 3000
    )

    return () => clearInterval(interval)
  }, [jobIds, options.enabled, options.pollInterval, fetchAllStatuses])

  return {
    statuses,
    isLoading,
    error,
    refresh: fetchAllStatuses,
  }
}
