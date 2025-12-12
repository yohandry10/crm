/**
 * Componentes Optimizados
 *
 * Este archivo centraliza las exportaciones de todos los componentes optimizados
 * para facilitar su importación y uso en la aplicación.
 */

// Sidebar optimizado
export { SidebarOptimized } from '@/components/dashboard/sidebar-optimized'

// Layout optimizado
export { default as DashboardLayoutOptimized } from '@/components/layout/dashboard-layout-optimized'

// Skeletons
export {
  TableModuleSkeleton,
  DashboardModuleSkeleton,
  KanbanModuleSkeleton,
  CalendarModuleSkeleton,
  GenericModuleSkeleton,
} from '@/components/ui/module-skeleton'

// Navigation loading provider
export {
  NavigationLoadingProvider,
  NavigationProgress,
  useNavigationLoading,
} from '@/components/providers/navigation-loading-provider'

// Hooks
export {
  useRoutePrefetch,
  useCRMPrefetch,
  FREQUENT_ROUTES,
} from '@/hooks/use-route-prefetch'

// Caché de usuario
export {
  userCache,
  useUserProfile,
  type UserProfile,
} from '@/lib/user-cache'
