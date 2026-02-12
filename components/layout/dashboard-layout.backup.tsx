"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { Header } from "@/components/dashboard/header"
import { TrialBanner } from "@/components/subscription/trial-banner"
import { WelcomeTour } from "@/components/tutorials"
import { KeyboardShortcutsDialog, useKeyboardShortcuts } from "@/components/keyboard"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Toaster } from "@/components/ui/sonner"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // Enable keyboard shortcuts
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
    const getOrganization = async () => {
      const supabase = getSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_organization_id")
        .eq("id", user.id)
        .single()

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
          .single()

        if (membership) {
          setOrganizationId(membership.organization_id)
        }
      }
    }
    getOrganization()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="lg:pl-72">
        {organizationId && <TrialBanner />}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Welcome tour for new users */}
      <WelcomeTour />

      {/* Keyboard shortcuts dialog */}
      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {/* Toast notifications - solo renderizar en cliente */}
      {mounted && <Toaster />}
    </div>
  )
}

export default DashboardLayout
