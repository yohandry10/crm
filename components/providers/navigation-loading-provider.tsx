"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

interface NavigationLoadingContextType {
  isLoading: boolean
  setIsLoading: (loading: boolean) => void
}

const NavigationLoadingContext = createContext<NavigationLoadingContextType>({
  isLoading: false,
  setIsLoading: () => { },
})

export function useNavigationLoading() {
  return useContext(NavigationLoadingContext)
}

/**
 * Provider que muestra un indicador de carga durante la navegación entre páginas
 * Mejora la UX mostrando feedback visual durante transiciones
 */
export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setIsLoading(true)

    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 150)

    return () => clearTimeout(timer)
  }, [pathname])

  return (
    <NavigationLoadingContext.Provider value={{ isLoading, setIsLoading }}>
      {/* Barra de progreso superior */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-gradient-to-r from-gray-700 to-gray-900"
            style={{ willChange: 'transform' }}
          >
            <motion.div
              className="h-full bg-white/30"
              initial={{ x: '-100%' }}
              animate={{ x: '100%' }}
              transition={{
                duration: 1,
                ease: 'easeInOut',
                repeat: Number.POSITIVE_INFINITY,
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {children}
    </NavigationLoadingContext.Provider>
  )
}

/**
 * Componente de barra de progreso minimalista para navegación
 */
export function NavigationProgress() {
  const { isLoading } = useNavigationLoading()

  if (!isLoading) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999]">
      <div className="h-0.5 bg-gradient-to-r from-gray-700 via-gray-800 to-gray-700 animate-pulse" />
    </div>
  )
}
