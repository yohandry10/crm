/**
 * Página: Dashboard de Colas (Bull Board)
 *
 * Dashboard visual para monitorear todas las colas de BullMQ
 *
 * Características:
 * - Ver jobs en tiempo real
 * - Reintentar jobs fallidos
 * - Limpiar colas
 * - Ver detalles y logs de cada job
 *
 * IMPORTANTE: Solo accesible para administradores
 */

'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function QueuesAdminPage() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // El iframe cargará el Bull Board
    setIsLoading(false)
  }, [])

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Monitoreo de Colas</h1>
        <p className="text-muted-foreground mt-2">
          Dashboard de BullMQ para workflows, emails e importaciones
        </p>
      </div>

      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full mt-2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
      )}

      <Card className={isLoading ? 'hidden' : ''}>
        <CardHeader>
          <CardTitle>Bull Board Dashboard</CardTitle>
          <CardDescription>
            Monitorea y gestiona jobs de todas las colas
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* iframe que carga Bull Board desde la API route */}
          <iframe
            src="/api/admin/bull-board"
            className="w-full h-[800px] border-0 rounded-b-lg"
            title="Bull Board Dashboard"
          />
        </CardContent>
      </Card>

      {/* Información adicional */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Workflows Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Cola para ejecución de workflows automatizados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Emails Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Cola para envío de emails en segundo plano
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Imports Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Cola para importación masiva de contactos/datos
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
