"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Home, Bug } from "lucide-react"
import { reportClientError } from "@/lib/client-error-reporting"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Application error:", error)
    void reportClientError({
      source: "app-error",
      message: error.message || "Error inesperado de aplicación",
      stack: error.stack,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="text-center max-w-md">
        {/* Error Icon */}
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-red-600 dark:text-red-400" />
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          ¡Ups! Algo salió mal
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Ha ocurrido un error inesperado. Nuestro equipo ha sido notificado
          y estamos trabajando para solucionarlo.
        </p>

        {/* Error details (only in development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-left">
            <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-gray-500 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={reset}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Intentar de nuevo
          </Button>
          <Button variant="outline" onClick={() => window.location.href = "/dashboard"}>
            <Home className="w-4 h-4 mr-2" />
            Ir al Dashboard
          </Button>
        </div>

        {/* Report bug */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
          Si el problema persiste,{" "}
          <button 
            onClick={() => {
              const subject = encodeURIComponent("Error en CRM")
              const body = encodeURIComponent(`
Descripción del error:
${error.message}

Error ID: ${error.digest || "N/A"}

Pasos para reproducir:
1. 
2. 
3. 

Navegador: ${navigator.userAgent}
              `)
              window.location.href = `mailto:soporte@tucrm.com?subject=${subject}&body=${body}`
            }}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <Bug className="w-3 h-3" />
            reportar el problema
          </button>
        </p>
      </div>
    </div>
  )
}
