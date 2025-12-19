"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Menu, Bell, Search, User, LogOut, Settings, UserCircle, Command } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { GlobalSearch, useGlobalSearch } from "@/components/search/global-search"

interface HeaderProps {
  onMenuClick: () => void
}

interface Notification {
  id: string
  title: string
  message: string
  type: string
  created_at: string
  is_read: boolean
}

export function Header({ onMenuClick }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const { open: searchOpen, setOpen: setSearchOpen } = useGlobalSearch()
  const supabaseRef = useRef<SupabaseClient | null>(null)
  const router = useRouter()

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ getSupabaseBrowserClient }) => {
      supabaseRef.current = getSupabaseBrowserClient()
    })
  }, [])

  const { data: notificationsResponse } = useSWR('/api/notifications?limit=10', {
    refreshInterval: 60000,
    dedupingInterval: 60000,
  })

  useEffect(() => {
    if (!notificationsResponse) return
    const nextNotifications = notificationsResponse.data || []
    const nextUnread = notificationsResponse.unreadCount || 0
    setNotifications(nextNotifications)
    setUnreadCount(nextUnread)
  }, [notificationsResponse])

  const handleLogout = async () => {
    const supabase = supabaseRef.current
    if (!supabase) return

    setLoggingOut(true)
    try {
      await supabase.auth.signOut()
      toast.success("Sesión cerrada")
      router.push("/login")
      router.refresh()
    } catch {
      toast.error("Error al cerrar sesión")
    } finally {
      setLoggingOut(false)
    }
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'ahora'
    if (diffMins < 60) return `hace ${diffMins} min`
    if (diffHours < 24) return `hace ${diffHours}h`
    return `hace ${diffDays}d`
  }

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-xl border-b border-gray-100 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          className="lg:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5" />
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="hidden sm:flex items-center gap-2 w-64 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400 hover:border-gray-300 hover:bg-gray-100 transition-all"
        >
          <Search className="w-4 h-4" />
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-500">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {notificationsOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
              >
                <div className="p-4 border-b border-gray-100">
                  <h4 className="font-semibold text-gray-900">Notificaciones</h4>
                </div>
                <div className="max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">Sin notificaciones</p>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className={cn(
                        "p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors",
                        !n.is_read && "bg-cyan-50/50"
                      )}>
                        <p className="text-sm font-medium text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-2">{formatTimeAgo(n.created_at)}</p>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <User className="w-5 h-5" />
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
              >
                <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <UserCircle className="w-4 h-4" />
                  Mi Perfil
                </Link>
                <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Settings className="w-4 h-4" />
                  Configuración
                </Link>
                <div className="border-t border-gray-100" />
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {loggingOut ? "Cerrando..." : "Cerrar Sesión"}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Global Search Modal */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
