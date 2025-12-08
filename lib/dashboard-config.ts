/**
 * Configuración de Dashboard Personalizable
 */

export interface DashboardWidget {
  id: string
  type: WidgetType
  title: string
  size: "small" | "medium" | "large"
  position: { x: number; y: number }
  config?: Record<string, any>
}

export type WidgetType = 
  | "stats-revenue"
  | "stats-contacts"
  | "stats-leads"
  | "stats-tasks"
  | "chart-sales"
  | "chart-pipeline"
  | "chart-revenue-trend"
  | "list-recent-contacts"
  | "list-pending-tasks"
  | "list-recent-invoices"
  | "calendar-upcoming"
  | "quick-actions"

export interface DashboardConfig {
  widgets: DashboardWidget[]
  layout: "grid" | "freeform"
  theme: "default" | "compact" | "spacious"
}

export const DEFAULT_WIDGETS: DashboardWidget[] = [
  { id: "w1", type: "stats-revenue", title: "Ingresos del Mes", size: "small", position: { x: 0, y: 0 } },
  { id: "w2", type: "stats-contacts", title: "Total Contactos", size: "small", position: { x: 1, y: 0 } },
  { id: "w3", type: "stats-leads", title: "Leads Activos", size: "small", position: { x: 2, y: 0 } },
  { id: "w4", type: "stats-tasks", title: "Tareas Pendientes", size: "small", position: { x: 3, y: 0 } },
  { id: "w5", type: "chart-sales", title: "Ventas por Mes", size: "large", position: { x: 0, y: 1 } },
  { id: "w6", type: "chart-pipeline", title: "Pipeline de Ventas", size: "medium", position: { x: 2, y: 1 } },
  { id: "w7", type: "list-pending-tasks", title: "Tareas Pendientes", size: "medium", position: { x: 0, y: 2 } },
  { id: "w8", type: "list-recent-contacts", title: "Contactos Recientes", size: "medium", position: { x: 2, y: 2 } },
]

export const AVAILABLE_WIDGETS: { type: WidgetType; label: string; description: string }[] = [
  { type: "stats-revenue", label: "Ingresos", description: "Muestra los ingresos del período" },
  { type: "stats-contacts", label: "Contactos", description: "Total de contactos" },
  { type: "stats-leads", label: "Leads", description: "Leads activos en el pipeline" },
  { type: "stats-tasks", label: "Tareas", description: "Tareas pendientes" },
  { type: "chart-sales", label: "Gráfico de Ventas", description: "Ventas por período" },
  { type: "chart-pipeline", label: "Pipeline", description: "Estado del pipeline de ventas" },
  { type: "chart-revenue-trend", label: "Tendencia de Ingresos", description: "Evolución de ingresos" },
  { type: "list-recent-contacts", label: "Contactos Recientes", description: "Últimos contactos agregados" },
  { type: "list-pending-tasks", label: "Tareas Pendientes", description: "Tareas por completar" },
  { type: "list-recent-invoices", label: "Facturas Recientes", description: "Últimas facturas emitidas" },
  { type: "calendar-upcoming", label: "Próximos Eventos", description: "Eventos del calendario" },
  { type: "quick-actions", label: "Acciones Rápidas", description: "Botones de acceso rápido" },
]

const STORAGE_KEY = "dashboard-config"

export function saveDashboardConfig(config: DashboardConfig): void {
  if (typeof window === "undefined") return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function loadDashboardConfig(): DashboardConfig {
  if (typeof window === "undefined") {
    return { widgets: DEFAULT_WIDGETS, layout: "grid", theme: "default" }
  }
  
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      return JSON.parse(stored)
    } catch {
      return { widgets: DEFAULT_WIDGETS, layout: "grid", theme: "default" }
    }
  }
  
  return { widgets: DEFAULT_WIDGETS, layout: "grid", theme: "default" }
}

export function resetDashboardConfig(): DashboardConfig {
  const config = { widgets: DEFAULT_WIDGETS, layout: "grid" as const, theme: "default" as const }
  saveDashboardConfig(config)
  return config
}
