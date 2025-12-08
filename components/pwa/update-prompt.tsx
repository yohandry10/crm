"use client"

import { useServiceWorker } from "@/hooks/use-service-worker"
import { Button } from "@/components/ui/button"
import { RefreshCw, X } from "lucide-react"
import { useState } from "react"

export function UpdatePrompt() {
  const { isUpdateAvailable, update } = useServiceWorker()
  const [dismissed, setDismissed] = useState(false)

  if (!isUpdateAvailable || dismissed) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-card border rounded-lg shadow-lg p-4 max-w-sm animate-in slide-in-from-right">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="font-medium text-sm">Nueva versión disponible</p>
          <p className="text-xs text-muted-foreground mt-1">
            Actualiza para obtener las últimas mejoras
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setDismissed(true)}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" onClick={update} className="gap-2">
          <RefreshCw className="w-3 h-3" />
          Actualizar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
          Después
        </Button>
      </div>
    </div>
  )
}
