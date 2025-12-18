/**
 * Componente: WorkflowToastTracker
 *
 * Muestra notificaciones toast del progreso de workflows
 * Perfecto para workflows ejecutados desde botones/acciones
 *
 * Uso:
 * ```tsx
 * import { toast } from 'sonner'
 * import { WorkflowToastTracker } from '@/components/workflows/workflow-toast-tracker'
 *
 * // Después de ejecutar workflow
 * const response = await fetch('/api/workflows/execute', {...})
 * const { jobId } = response.data
 *
 * // Mostrar toast con tracker
 * toast.custom((t) => (
 *   <WorkflowToastTracker
 *     jobId={jobId}
 *     workflowName="Bienvenida"
 *     onDismiss={() => toast.dismiss(t)}
 *   />
 * ))
 * ```
 */

'use client'

import { useEffect } from 'react'
import { useJobStatus } from '@/hooks/use-job-status'
import { toast } from 'sonner'
import { Loader2, CheckCircle2, XCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface WorkflowToastTrackerProps {
  jobId: string
  workflowName: string
  onDismiss?: () => void
  autoClose?: boolean
  autoCloseDelay?: number
}

export function WorkflowToastTracker({
  jobId,
  workflowName,
  onDismiss,
  autoClose = true,
  autoCloseDelay = 3000,
}: WorkflowToastTrackerProps) {
  const {
    status,
    isWaiting,
    isActive,
    isCompleted,
    isFailed,
    progress,
  } = useJobStatus(jobId)

  // Auto-cerrar cuando se completa
  useEffect(() => {
    if (autoClose && (isCompleted || isFailed) && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss()
      }, autoCloseDelay)

      return () => clearTimeout(timer)
    }
  }, [isCompleted, isFailed, autoClose, autoCloseDelay, onDismiss])

  return (
    <div className="bg-background border rounded-lg shadow-lg p-4 min-w-[350px]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          {/* Icono según estado */}
          {(isWaiting || isActive) && (
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-0.5" />
          )}
          {isCompleted && (
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
          )}
          {isFailed && <XCircle className="h-5 w-5 text-red-600 mt-0.5" />}

          {/* Contenido */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{workflowName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {status?.stateMessage || 'Iniciando...'}
            </p>

            {/* Barra de progreso para workflows activos */}
            {(isWaiting || isActive) && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Progreso</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Resultado */}
            {isCompleted && status?.result && (
              <div className="mt-2 text-xs text-green-700 bg-green-50 px-2 py-1 rounded">
                ✓ {status.result.executedActions || 0} acciones completadas
                {status.result.duration_ms &&
                  ` en ${(status.result.duration_ms / 1000).toFixed(1)}s`}
              </div>
            )}

            {/* Error */}
            {isFailed && status?.error && (
              <div className="mt-2 text-xs text-red-700 bg-red-50 px-2 py-1 rounded">
                {status.error}
              </div>
            )}
          </div>
        </div>

        {/* Botón cerrar */}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Helper para mostrar workflow toast fácilmente
 */
export function showWorkflowToast(jobId: string, workflowName: string) {
  return toast.custom(
    (t) => (
      <WorkflowToastTracker
        jobId={jobId}
        workflowName={workflowName}
        onDismiss={() => toast.dismiss(t)}
      />
    ),
    {
      duration: Infinity, // No cerrar automáticamente hasta que termine
    }
  )
}
