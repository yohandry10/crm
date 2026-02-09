"use client"

import type React from "react"
import { useState, useEffect, Suspense } from "react"
import dynamic from "next/dynamic"
import { SidebarOptimized } from "@/components/dashboard/sidebar-optimized"
import { Header } from "@/components/dashboard/header"
import { useCRMPrefetch } from "@/hooks/use-route-prefetch"
import { useKeyboardShortcuts } from "@/components/keyboard"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Toaster } from "@/components/ui/sonner"

// Lazy load componentes pesados que no son críticos para la primera carga
const TrialBanner = dynamic(
  () => import("@/components/subscription/trial-banner").then(mod => ({ default: mod.TrialBanner })),
  {
    loading: () => <div className="h-12" />, // Placeholder para evitar layout shift
    ssr: false // No renderizar en servidor
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

export function DashboardLayoutOptimized({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

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

  useEffect(() => {
    let isMounted = true

    const getOrganization = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !isMounted) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_organization_id")
        .eq("id", user.id)
        .maybeSingle()

      if (!isMounted) return

      if (profile?.current_organization_id) {
        setOrganizationId(profile.current_organization_id)
      } else {
        // Get first organization
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()

        if (membership && isMounted) {
          setOrganizationId(membership.organization_id)
        }
      }
    }

    getOrganization()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <SidebarOptimized open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="lg:pl-72">
        {/* Lazy load trial banner */}
        {mounted && organizationId && (
          <Suspense fallback={<div className="h-12" />}>
            <TrialBanner organizationId={organizationId} />
          </Suspense>
        )}

        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Lazy load componentes no críticos */}
      {mounted && (
        <>
          <Suspense fallback={null}>
            <WelcomeTour />
          </Suspense>

          <Suspense fallback={null}>
            <KeyboardShortcutsDialog
              open={shortcutsOpen}
              onOpenChange={setShortcutsOpen}
            />
          </Suspense>

          {/* Toast notifications */}
          <Toaster />
        </>
      )}
    </div>
  )
}

export default DashboardLayoutOptimized
