/**
 * Componente: WorkflowStatusTracker
 *
 * Muestra el progreso de un workflow en ejecución
 *
 * Características:
 * - Barra de progreso animada
 * - Estados visuales (esperando, procesando, completado, fallido)
 * - Auto-actualización cada 2 segundos
 * - Muestra detalles del resultado
 */

'use client'

import { useJobStatus } from '@/hooks/use-job-status'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react'

interface WorkflowStatusTrackerProps {
  jobId: string
  workflowName?: string
  onComplete?: (result: any) => void
  onError?: (error: string) => void
  showDetails?: boolean
}

export function WorkflowStatusTracker({
  jobId,
  workflowName,
  onComplete,
  onError,
  showDetails = true,
}: WorkflowStatusTrackerProps) {
  const {
    status,
    isLoading,
    error,
    refresh,
    cancel,
    isWaiting,
    isActive,
    isCompleted,
    isFailed,
    isFinished,
    progress,
  } = useJobStatus(jobId, {
    onComplete,
    onError,
  })

  // Estados y sus estilos
  const stateConfig = {
    waiting: {
      icon: Clock,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      badge: 'secondary',
      message: 'En cola',
    },
    active: {
      icon: Loader2,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      badge: 'default',
      message: 'Procesando',
    },
    completed: {
      icon: CheckCircle2,
      color: 'text-green-600',
      bg: 'bg-green-50',
      badge: 'default',
      message: 'Completado',
    },
    failed: {
      icon: XCircle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      badge: 'destructive',
      message: 'Fallido',
    },
    delayed: {
      icon: Clock,
      color: 'text-gray-600',
      bg: 'bg-gray-50',
      badge: 'secondary',
      message: 'Programado',
    },
    paused: {
      icon: AlertCircle,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      badge: 'secondary',
      message: 'Pausado',
    },
  }

  const currentState = status?.state || 'waiting'
  const config = stateConfig[currentState]
  const Icon = config.icon

  return (
    <Card className={config.bg}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon
              className={`h-6 w-6 ${config.color} ${isActive ? 'animate-spin' : ''}`}
            />
            <div>
              <CardTitle className="text-lg">
                {workflowName || 'Workflow'}
              </CardTitle>
              <CardDescription>
                {status?.stateMessage || 'Cargando...'}
              </CardDescription>
            </div>
          </div>
          <Badge variant={config.badge as any}>{config.message}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barra de progreso */}
        {!isFinished && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Detalles */}
        {showDetails && status && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Job ID:</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {jobId.slice(0, 20)}...
              </code>
            </div>

            {status.attemptsMade > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Intentos:</span>
                <span>{status.attemptsMade}</span>
              </div>
            )}

            {status.duration_ms && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Duración:</span>
                <span>{(status.duration_ms / 1000).toFixed(2)}s</span>
              </div>
            )}

            {/* Resultado si está completado */}
            {isCompleted && status.result && (
              <div className="pt-2 border-t">
                <p className="text-muted-foreground mb-2">Resultado:</p>
                <div className="bg-muted/50 p-3 rounded text-xs space-y-1">
                  {status.result.executedActions !== undefined && (
                    <div>
                      ✓ Acciones ejecutadas: {status.result.executedActions}
                    </div>
                  )}
                  {status.result.failedActions !== undefined &&
                    status.result.failedActions > 0 && (
                      <div className="text-red-600">
                        ✗ Acciones fallidas: {status.result.failedActions}
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Error si falló */}
            {isFailed && status.error && (
              <div className="pt-2 border-t">
                <p className="text-red-600 font-medium mb-1">Error:</p>
                <p className="text-xs bg-red-50 text-red-700 p-2 rounded">
                  {status.error}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
          >
            Actualizar
          </Button>

          {!isFinished && (
            <Button
              variant="destructive"
              size="sm"
              onClick={cancel}
              disabled={isLoading || isActive}
            >
              Cancelar
            </Button>
          )}
        </div>

        {/* Error general */}
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Versión compacta para mostrar en listas
 */
export function WorkflowStatusBadge({
  jobId,
  compact = false,
}: {
  jobId: string
  compact?: boolean
}) {
  const { status, isLoading } = useJobStatus(jobId)

  if (isLoading && !status) {
    return <Badge variant="secondary">Cargando...</Badge>
  }

  const stateColors = {
    waiting: 'secondary',
    active: 'default',
    completed: 'default',
    failed: 'destructive',
    delayed: 'secondary',
    paused: 'secondary',
  }

  const stateIcons = {
    waiting: '⏳',
    active: '⚙️',
    completed: '✅',
    failed: '❌',
    delayed: '⏰',
    paused: '⏸️',
  }

  return (
    <Badge variant={stateColors[status?.state || 'waiting'] as any}>
      {stateIcons[status?.state || 'waiting']}{' '}
      {!compact && (status?.stateMessage || 'Cargando...')}
      {status?.state === 'active' && ` ${Math.round(status.progress)}%`}
    </Badge>
  )
}
