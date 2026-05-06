import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requirePlatformAdmin } from "@/lib/auth-helpers"
import { getEmailQueueStats } from "@/lib/queues/email-queue"
import { getImportQueueStats } from "@/lib/queues/import-queue"
import { getQueueStats } from "@/lib/queues/workflow-queue"
import { Activity, AlertTriangle, CheckCircle2, Clock, ListChecks, XCircle } from "lucide-react"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type QueueStats = {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed?: number
  total: number
}

type QueueSnapshot = {
  key: string
  label: string
  description: string
  stats: QueueStats | null
  status: "ready" | "error"
}

async function readQueueStats(
  key: string,
  label: string,
  description: string,
  loader: () => Promise<QueueStats>
): Promise<QueueSnapshot> {
  try {
    return {
      key,
      label,
      description,
      stats: await loader(),
      status: "ready",
    }
  } catch {
    return {
      key,
      label,
      description,
      stats: null,
      status: "error",
    }
  }
}

function getTotal(queues: QueueSnapshot[], field: keyof QueueStats) {
  return queues.reduce((total, queue) => total + Number(queue.stats?.[field] || 0), 0)
}

function formatMetric(value: number | undefined) {
  return new Intl.NumberFormat("es-PE").format(value || 0)
}

export default async function QueuesAdminPage() {
  await requirePlatformAdmin()

  const queues = await Promise.all([
    readQueueStats(
      "workflows",
      "Workflows",
      "Ejecucion asincrona de automatizaciones y acciones del CRM.",
      getQueueStats
    ),
    readQueueStats(
      "emails",
      "Emails",
      "Envio en segundo plano de notificaciones y mensajes transaccionales.",
      getEmailQueueStats
    ),
    readQueueStats(
      "imports",
      "Importaciones",
      "Procesamiento asincrono de cargas masivas de datos.",
      getImportQueueStats
    ),
  ])

  const hasQueueErrors = queues.some((queue) => queue.status === "error")
  const waiting = getTotal(queues, "waiting")
  const active = getTotal(queues, "active")
  const failed = getTotal(queues, "failed")
  const completed = getTotal(queues, "completed")

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Monitoreo de Colas</h1>
          <p className="text-muted-foreground mt-2">
            Estado real de BullMQ para workflows, emails e importaciones.
          </p>
        </div>
        <Badge variant={hasQueueErrors ? "destructive" : "default"} className="h-8 px-3">
          {hasQueueErrors ? (
            <AlertTriangle className="mr-2 h-4 w-4" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          {hasQueueErrors ? "Revisar Redis" : "Operativo"}
        </Badge>
      </div>

      {hasQueueErrors && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Algunas colas no respondieron</AlertTitle>
          <AlertDescription>
            La vista esta protegida y no muestra detalles sensibles. Revisa la disponibilidad de Redis y el worker/drainer
            configurado para produccion.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>En espera</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Clock className="h-5 w-5 text-amber-500" />
              {formatMetric(waiting)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Activos</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <Activity className="h-5 w-5 text-cyan-500" />
              {formatMetric(active)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completados</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              {formatMetric(completed)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Fallidos</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <XCircle className="h-5 w-5 text-red-500" />
              {formatMetric(failed)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {queues.map((queue) => (
          <Card key={queue.key}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-cyan-600" />
                  {queue.label}
                </CardTitle>
                <Badge variant={queue.status === "ready" ? "outline" : "destructive"}>
                  {queue.status === "ready" ? "Conectada" : "Sin lectura"}
                </Badge>
              </div>
              <CardDescription>{queue.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {queue.stats ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">En espera</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetric(queue.stats.waiting)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Activos</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetric(queue.stats.active)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Completados</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetric(queue.stats.completed)}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Fallidos</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetric(queue.stats.failed)}</p>
                  </div>
                  {typeof queue.stats.delayed === "number" && (
                    <div className="rounded-md border p-3">
                      <p className="text-muted-foreground">Programados</p>
                      <p className="mt-1 text-xl font-semibold">{formatMetric(queue.stats.delayed)}</p>
                    </div>
                  )}
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Total retenido</p>
                    <p className="mt-1 text-xl font-semibold">{formatMetric(queue.stats.total)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No se pudo leer esta cola desde Redis en este momento.
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
