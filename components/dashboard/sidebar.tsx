"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Home, Users, FileText, Settings,
  Calendar, Package, Mail, Target, CheckSquare,
  TrendingUp, Receipt, Briefcase, Layers, Link2,
  Kanban, FileBarChart
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Contactos", href: "/contacts", icon: Users },
  { name: "Leads", href: "/leads", icon: Target },
  { name: "Pipeline", href: "/pipeline", icon: Kanban },
  { name: "Oportunidades", href: "/sales", icon: Briefcase },
  { name: "Cotizaciones", href: "/quotes", icon: FileText },
  { name: "Facturación", href: "/invoicing", icon: Receipt },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Campañas", href: "/campaigns", icon: Mail },
  { name: "Tareas", href: "/tasks", icon: CheckSquare },
  { name: "Calendario", href: "/calendar", icon: Calendar },
  { name: "Inventario", href: "/inventory", icon: Layers },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Reportes", href: "/reports/builder", icon: FileBarChart },
  { name: "Workflows", href: "/workflows", icon: Settings },
  { name: "Integraciones", href: "/integrations", icon: Link2 },
  { name: "Configuración", href: "/settings", icon: Settings },
]

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function loadUser() {
      try {
        const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser')
        const supabase = getSupabaseBrowserClient()
        const { data: { user: authUser } } = await supabase.auth.getUser()

        if (authUser) {
          // Get profile data (role doesn't exist in profiles table)
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, current_organization_id')
            .eq('id', authUser.id)
            .single()

          // Get role from organization_members
          let role = 'member'
          if (profile?.current_organization_id) {
            const { data: membership } = await supabase
              .from('organization_members')
              .select('role')
              .eq('user_id', authUser.id)
              .eq('organization_id', profile.current_organization_id)
              .single()
            if (membership?.role) {
              role = membership.role
            }
          }

          setUser({ ...authUser, profile: { ...profile, role } })
        }
      } catch (error) {
        console.error('Error loading user:', error)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [])

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
            onClick={() => onOpenChange(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        suppressHydrationWarning
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out flex flex-col",
          "lg:translate-x-0 lg:fixed",
          /* Sidebar logic: Fixed positioning, responsive transitions */
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-gray-100">
          <Link href="/dashboard" className="flex flex-col leading-none">
            <span className="text-xl font-bold text-gray-900">NEON</span>
            <span className="text-[9px] font-semibold tracking-[0.25em] text-cyan-600 uppercase">System</span>
          </Link>
          <button
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navigation.map((item) => {
              const isCurrent = pathname === item.href
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "group flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
                      isCurrent
                        ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    <item.icon className={cn(
                      "w-5 h-5 transition-colors",
                      isCurrent ? "text-white" : "text-gray-400 group-hover:text-gray-600"
                    )} />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Card */}
        <div className="p-4 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-white">
                  {loading ? '...' : (user?.email?.substring(0, 2).toUpperCase() || 'U')}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {loading ? 'Cargando...' : (user?.profile?.full_name || user?.email || 'Usuario')}
                </p>
                <p className="text-xs text-gray-500 truncate capitalize">
                  {loading ? '...' : (user?.profile?.role || 'user')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
