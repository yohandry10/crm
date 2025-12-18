"use client"

import { SWRConfig } from 'swr'
import type { ReactNode } from 'react'

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
    if (!response.ok) {
      const error = new Error(`HTTP ${response.status}`)
      throw error
    }
    const json = await response.json()
    if (!json.success) {
      throw new Error(json.error || 'Request failed')
    }
    return json
  },
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return <SWRConfig value={swrConfig}>{children}</SWRConfig>
}
