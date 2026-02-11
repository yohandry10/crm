"use client"

import type React from "react"
import { useState, useEffect } from "react"
import dynamic from "next/dynamic"
import { SidebarOptimized } from "@/components/dashboard/sidebar-optimized"
import { Header } from "@/components/dashboard/header"
import { useCRMPrefetch } from "@/hooks/use-route-prefetch"
import { useKeyboardShortcuts } from "@/components/keyboard"
import { useAuth } from "@/components/providers/auth-provider"
import { Toaster } from "@/components/ui/sonner"
import { useTheme } from "@/hooks/use-theme"

// Lazy load componentes pesados que no son críticos para la primera carga
const TrialBanner = dynamic(
  () => import("@/components/subscription/trial-banner").then(mod => ({ default: mod.TrialBanner })),
  {
    loading: () => <div className="h-12" />,
    ssr: false
  }
)

const WelcomeTour = dynamic(
  () => import("@/components/tutorials").then(mod => ({ default: mod.WelcomeTour })),
  {
    loading: () => null,
    ssr: false
  }
)

const KeyboardShortcutsDialog = dynamic(
  () => import("@/components/keyboard").then(mod => ({ default: mod.KeyboardShortcutsDialog })),
  {
    loading: () => null,
    ssr: false
  }
)

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ✅ Use cached auth data from AuthProvider
  const { organizationId } = useAuth()

  // ✅ Use theme for dynamic styling
  const { getBgClass, getTextClass } = useTheme()

  // Prefetch rutas frecuentes en segundo plano
  useCRMPrefetch()

  // Keyboard shortcuts
  useKeyboardShortcuts()

  // Evitar hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for show-shortcuts event
  useEffect(() => {
    const handleShowShortcuts = () => setShortcutsOpen(true)
    window.addEventListener("show-shortcuts", handleShowShortcuts)
    return () => window.removeEventListener("show-shortcuts", handleShowShortcuts)
  }, [])

  return (
    <div className={`min-h-screen ${getBgClass()} ${getTextClass()}`}>
      <SidebarOptimized open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="lg:pl-72">
        {mounted && organizationId && <TrialBanner organizationId={organizationId} />}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Lazy load componentes no críticos */}
      {mounted && (
        <>
          <WelcomeTour />

          <KeyboardShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />

          {/* Toast notifications */}
          <Toaster />
        </>
      )}
    </div>
  )
}

export default DashboardLayout
