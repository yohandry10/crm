"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Loader2, Shield, Building2, CreditCard, BarChart3, Settings, LogOut, Users, Sun, Moon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/organizations", label: "Organizaciones", icon: Building2 },
  { href: "/admin/subscriptions", label: "Suscripciones", icon: CreditCard },
  { href: "/admin/users", label: "Usuarios", icon: Users },
  { href: "/admin/settings", label: "Configuración", icon: Settings },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient())
  }, [])

  useEffect(() => {
    if (supabase) checkPlatformAdmin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const checkPlatformAdmin = async () => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_platform_admin")
        .eq("id", user.id)
        .single()

      if (!profile?.is_platform_admin) {
        router.push("/dashboard")
        return
      }

      setIsPlatformAdmin(true)
    } catch {
      router.push("/login")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut()
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isPlatformAdmin) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <span className="font-semibold text-gray-900 dark:text-white">Super Admin</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">Panel de Administración</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== "/admin" && pathname?.startsWith(item.href))
            
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header with theme toggle */}
        <header className="sticky top-0 z-10 h-14 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-8">
          <ThemeToggle />
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
