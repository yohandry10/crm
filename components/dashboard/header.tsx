"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import useSWR from "swr"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Menu, Bell, Search, User, LogOut, Settings, UserCircle, Command, Clock } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { GlobalSearch, useGlobalSearch } from "@/components/search/global-search"
import { useTheme } from "@/hooks/use-theme"

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
  const { getGradientClass } = useTheme()

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
    <header className="sticky top-0 z-30 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4 lg:hidden">
          <Button variant="ghost" size="icon" onClick={onMenuClick} className="-ml-2 hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </Button>
          <span className="font-bold text-gray-900 dark:text-white">NEON</span>
        </div>

        <div className="flex-1 hidden lg:block max-w-xl">
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Mobile Search Trigger */}
          <div className="lg:hidden">
            <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="hover:bg-gray-100 dark:hover:bg-gray-800">
              <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Button>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="hidden md:flex items-center px-3 py-1.5 rounded-full bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium border border-blue-100/50 dark:border-blue-800/30">
                  <Clock className="w-3.5 h-3.5 mr-1.5" />
                  <span>Periodo de prueba: 2 días restantes</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Tu periodo de prueba termina pronto</p>
                <Button variant="link" size="sm" className="h-auto p-0 text-blue-600 dark:text-blue-400 font-bold" onClick={() => router.push('/settings/billing')}>
                  Ver Planes
                </Button>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="relative hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full w-10 h-10"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              {unreadCount > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full ${getGradientClass()} flex items-center justify-center text-[10px] font-bold text-white`}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            <AnimatePresence>
              {notificationsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-12 right-0 w-80 md:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden z-50 origin-top-right"
                >
                  <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notificaciones</h3>
                    {unreadCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          // Logic to mark all as read would go here
                          setUnreadCount(0)
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 h-auto p-0"
                      >
                        Marcar todo como leído
                      </Button>
                    )}
                  </div>

                  <div className="max-h-[400px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Bell className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                        </div>
                        <p>No tienes notificaciones nuevas</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${!notification.is_read ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                          >
                            <div className="flex gap-3">
                              <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!notification.is_read ? 'bg-blue-500' : 'bg-transparent'}`} />
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{notification.title}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{notification.message}</p>
                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                                  {new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="pl-2 border-l border-gray-200 dark:border-gray-700 ml-1 relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

            <AnimatePresence>
              {userMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-xl overflow-hidden z-50 origin-top-right"
                >
                  <Link href="/profile" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <UserCircle className="w-4 h-4" />
                    Mi Perfil
                  </Link>
                  <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <Settings className="w-4 h-4" />
                    Configuración
                  </Link>
                  <div className="border-t border-gray-100 dark:border-gray-800" />
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {loggingOut ? "Cerrando..." : "Cerrar Sesión"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  )
}
