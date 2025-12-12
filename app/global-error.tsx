"use client"

import { useEffect } from "react"

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log the error to console
    console.error("Global error:", error)
  }, [error])

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4 font-sans">
          <div className="text-center max-w-[400px]">
            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
              <svg 
                width="40" 
                height="40" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#dc2626" 
                strokeWidth="2"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            {/* Message */}
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Error crítico
            </h1>
            <p className="text-gray-500 mb-6">
              Ha ocurrido un error grave en la aplicación.
              Por favor, recarga la página o contacta a soporte.
            </p>

            {/* Actions */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={reset}
                className="px-4 py-2 bg-blue-500 text-white border-none rounded-md cursor-pointer font-medium hover:bg-blue-600 transition-colors"
              >
                Intentar de nuevo
              </button>
              <button
                onClick={() => window.location.href = "/"}
                className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md cursor-pointer font-medium hover:bg-gray-50 transition-colors"
              >
                Ir al inicio
              </button>
            </div>

            {/* Error ID */}
            {error.digest && (
              <p className="mt-6 text-xs text-gray-400">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
