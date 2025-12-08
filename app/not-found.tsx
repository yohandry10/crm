"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Home, ArrowLeft, Search, HelpCircle } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="text-center max-w-md">
        {/* 404 Illustration */}
        <div className="relative mb-8">
          <div className="text-[150px] font-bold text-gray-200 dark:text-gray-700 leading-none select-none">
            404
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="w-12 h-12 text-primary" />
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Página no encontrada
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Lo sentimos, la página que buscas no existe o ha sido movida.
          Verifica la URL o regresa al inicio.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/dashboard">
              <Home className="w-4 h-4 mr-2" />
              Ir al Dashboard
            </Link>
          </Button>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver atrás
          </Button>
        </div>

        {/* Help link */}
        <p className="mt-8 text-sm text-gray-500 dark:text-gray-500">
          ¿Necesitas ayuda?{" "}
          <Link href="/settings" className="text-primary hover:underline inline-flex items-center gap-1">
            <HelpCircle className="w-3 h-3" />
            Contactar soporte
          </Link>
        </p>
      </div>
    </div>
  )
}
