"use client"

import { useCallback, memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Home, Users, FileText, Settings,
  Calendar, Package, Mail, Target, CheckSquare,
  TrendingUp, Receipt, Briefcase, Link2,
  FileBarChart
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/components/providers/auth-provider"
import { useTheme } from "@/hooks/use-theme"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface NavItem {
  name: string
  href: string
  icon: LucideIcon
}


// Navigation data - memoized outside component
const navigation: NavItem[] = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Contactos", href: "/contacts", icon: Users },
  { name: "Leads", href: "/leads", icon: Target },
  { name: "Oportunidades", href: "/pipeline", icon: Briefcase },
  { name: "Cotizaciones", href: "/quotes", icon: FileText },
  { name: "Facturación", href: "/invoicing", icon: Receipt },
  { name: "Productos", href: "/products", icon: Package },
  { name: "Campañas", href: "/campaigns", icon: Mail },
  { name: "Formularios", href: "/forms", icon: FileText },
  { name: "Tareas", href: "/tasks", icon: CheckSquare },
  { name: "Calendario", href: "/calendar", icon: Calendar },
  { name: "Analytics", href: "/analytics", icon: TrendingUp },
  { name: "Reportes", href: "/reports/builder", icon: FileBarChart },
  { name: "Workflows", href: "/workflows", icon: Settings },
  { name: "Integraciones", href: "/integrations", icon: Link2 },
  { name: "Configuración", href: "/settings", icon: Settings },
]

// Optimized NavLink component with React.memo
const NavLink = memo(({
  item,
  isCurrent,
  onClick
}: {
  item: NavItem
  isCurrent: boolean
  onClick: () => void
}) => {
  const { getGradientClass } = useTheme()

  return (
    <Link
      href={item.href}
      onClick={onClick}
      prefetch={true} // Enable automatic prefetching
      className={cn(
        "group flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200",
        isCurrent
          ? `${getGradientClass()} text-white shadow-md shadow-gray-900/25`
          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
    >
      <item.icon className={cn(
        "w-5 h-5 transition-colors",
        isCurrent ? "text-white" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
      )} />
      {item.name}
    </Link>
  )
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if current state changes
  return prevProps.isCurrent === nextProps.isCurrent
})

NavLink.displayName = "NavLink"

// Optimized UserCard component with React.memo - uses AuthProvider
const UserCard = memo(() => {
  const { profile, loading } = useAuth()
  const { getGradientClass } = useTheme()

  return (
    <div className="p-4 border-t border-gray-100 dark:border-gray-800">
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl ${getGradientClass()} flex items-center justify-center flex-shrink-0`}>
            <span className="text-sm font-bold text-white">
              {loading ? '...' : (profile?.initials || 'U')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
              {loading ? 'Cargando...' : (profile?.full_name || 'Usuario')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {loading ? '...' : (profile?.email || '')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

UserCard.displayName = "UserCard"

export function SidebarOptimized({ open, onOpenChange }: SidebarProps) {
  const pathname = usePathname()

  // Memoized close handler
  const handleClose = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

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
            onClick={handleClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        suppressHydrationWarning
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border transform transition-transform duration-200 ease-in-out flex flex-col",
          "lg:translate-x-0 lg:fixed",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-20 items-center justify-between px-6 border-b border-border">
          <Link href="/dashboard" className="relative h-10 w-32 transition-opacity hover:opacity-80" prefetch={true}>
            {/* Logo wrapper to ensure proper positioning */}
            <div className="relative w-full h-full">
              {/* Logo for light mode - black text */}
              <img
                src="/logo-black.png"
                alt="Zion Logo"
                className="absolute inset-0 w-full h-full object-contain object-left dark:hidden"
              />
              {/* Logo for dark mode - white text */}
              <img
                src="/logo-white.png"
                alt="Zion Logo"
                className="absolute inset-0 w-full h-full object-contain object-left hidden dark:block"
              />
            </div>
          </Link>
          <button
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            onClick={handleClose}
            aria-label="Cerrar menú"
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
                <li key={item.href}>
                  <NavLink
                    item={item}
                    isCurrent={isCurrent}
                    onClick={handleClose}
                  />
                </li>
              )
            })}
          </ul>
        </nav>

        {/* User Card */}
        <UserCard />
      </aside>
    </>
  )
}
