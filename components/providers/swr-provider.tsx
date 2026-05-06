"use client"

import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'
import { reportClientError } from '@/lib/client-error-reporting'

class ApiClientError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
  }
}

// ✅ Configuración global optimizada para SWR
const swrConfig = {
  // Revalidar menos agresivamente
  revalidateOnFocus: false,
  revalidateOnReconnect: true,

  // Deduplicar requests cercanos (10 minutos)
  dedupingInterval: 10 * 60 * 1000,

  // Mantener datos en caché incluso si hay error
  shouldRetryOnError: false,

  // Mantener datos anteriores mientras recarga
  keepPreviousData: true,

  // Error retry
  errorRetryCount: 2,
  errorRetryInterval: 5000,

  // Fetcher por defecto
  fetcher: async (url: string) => {
    const response = await fetch(url, { credentials: 'include' })
    let json: any = null
    try {
      json = await response.json()
    } catch {
      json = null
    }

    if (!response.ok) {
      throw new ApiClientError(
        json?.error || 'No pudimos cargar esta información. Intenta nuevamente.',
        response.status,
        json?.code
      )
    }

    if (!json.success) {
      throw new ApiClientError(json.error || 'No pudimos completar la solicitud.', response.status, json.code)
    }
    return json
  },

  onError: (error: any, key: string) => {
    void reportClientError({
      source: 'swr',
      message: error?.message || 'Error cargando datos',
      stack: error?.stack,
      path: key,
    })
  },
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>
}
