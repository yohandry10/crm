/**
 * Feature Flag Components
 *
 * Componentes de React para usar feature flags en el frontend
 */

'use client'

import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/feature-flags'
import { useState, useEffect } from 'react'

/**
 * Hook para usar feature flags en componentes client
 */
export function useFeatureFlag(
  flagKey: string,
  context: FeatureFlagContext = {}
): boolean {
  const [enabled, setEnabled] = useState(() =>
    isFeatureEnabled(flagKey, context)
  )

  useEffect(() => {
    setEnabled(isFeatureEnabled(flagKey, context))
  }, [flagKey, context])

  return enabled
}

/**
 * Componente wrapper para renderizar basado en feature flag
 *
 * Uso:
 * ```tsx
 * <FeatureFlag flag="dark_mode" context={{ userId }}>
 *   <DarkModeToggle />
 * </FeatureFlag>
 * ```
 */
export function FeatureFlag({
  flag,
  context = {},
  children,
  fallback = null,
}: {
  flag: string
  context?: FeatureFlagContext
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const enabled = useFeatureFlag(flag, context)
  return <>{enabled ? children : fallback}</>
}

/**
 * Componente para mostrar badge de feature experimental
 */
export function ExperimentalBadge() {
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
      Experimental
    </span>
  )
}

/**
 * Componente para mostrar badge de feature beta
 */
export function BetaBadge() {
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      Beta
    </span>
  )
}

/**
 * Componente para mostrar badge de feature pro
 */
export function ProBadge() {
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
      Pro
    </span>
  )
}
