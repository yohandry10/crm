"use client"

import { useCallback, useRef } from "react"

/**
 * Hook para crear callbacks estables que no cambian entre renders
 * Útil para evitar re-renders innecesarios en componentes hijos
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args)
  }, []) as T
}

/**
 * Hook para memoizar valores que dependen de comparación profunda
 */
export function useDeepMemo<T>(value: T, deps: any[]): T {
  const ref = useRef<{ value: T; deps: any[] }>({ value, deps })

  const depsChanged = deps.some((dep, i) => {
    return JSON.stringify(dep) !== JSON.stringify(ref.current.deps[i])
  })

  if (depsChanged) {
    ref.current = { value, deps }
  }

  return ref.current.value
}
