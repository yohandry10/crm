"use client"

import { WifiOff, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function OfflinePage() {
  const handleRetry = () => {
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="w-20 h-20 mx-auto bg-muted rounded-full flex items-center justify-center">
          <WifiOff className="w-10 h-10 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Sin Conexión</h1>
          <p className="text-muted-foreground">
            No tienes conexión a internet. Algunas funciones pueden no estar disponibles.
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Reintentar
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Los datos guardados localmente seguirán disponibles y se sincronizarán cuando vuelvas a conectarte.
          </p>
        </div>
      </div>
    </div>
  )
}
