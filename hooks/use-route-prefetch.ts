"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Hook para pre-cargar rutas frecuentemente visitadas
 * Esto mejora la velocidad de navegación al pre-cargar las rutas en segundo plano
 */
export function useRoutePrefetch(routes: string[] = []) {
  const router = useRouter()

  useEffect(() => {
    // Esperar a que la página se cargue completamente
    if (typeof window === 'undefined') return

    // Usar requestIdleCallback para no bloquear el thread principal
    const prefetchRoutes = () => {
      routes.forEach(route => {
        try {
          router.prefetch(route)
        } catch (error) {
          console.warn(`Failed to prefetch route: ${route}`, error)
        }
      })
    }

    // Prefetch después de que el navegador esté inactivo
    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(prefetchRoutes, {
        timeout: 2000
      })

      return () => {
        window.cancelIdleCallback(idleCallbackId)
      }
    } else {
      // Fallback para navegadores que no soportan requestIdleCallback
      const timeoutId = setTimeout(prefetchRoutes, 1000)
      return () => clearTimeout(timeoutId)
    }
  }, [router, routes])
}

/**
 * Rutas más frecuentemente visitadas en el CRM
 */
export const FREQUENT_ROUTES = [
  '/dashboard',
  '/contacts',
  '/leads',
  '/pipeline',
  '/sales',
  '/tasks',
  '/calendar',
] as const

/**
 * Hook simplificado para prefetch de rutas frecuentes del CRM
 */
export function useCRMPrefetch() {
  useRoutePrefetch(FREQUENT_ROUTES as unknown as string[])
}
