"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { DashboardConfig, loadDashboardConfig } from "@/lib/dashboard-config"
import { WidgetRenderer } from "./widget-renderer"
import { DashboardCustomizer } from "./dashboard-customizer"

interface DashboardData {
  revenue?: { revenue: number; growth: number }
  contacts?: { total: number; new: number }
  leads?: { active: number; qualified: number }
  tasks?: { pending: number; overdue: number; tasks: any[] }
  recentContacts?: { contacts: any[] }
}

interface CustomizableDashboardProps {
  data?: DashboardData
}

export function CustomizableDashboard({ data }: CustomizableDashboardProps) {
  const [config, setConfig] = useState<DashboardConfig | null>(null)

  useEffect(() => {
    setConfig(loadDashboardConfig())
  }, [])

  const handleConfigChange = useCallback((newConfig: DashboardConfig) => {
    setConfig(newConfig)
  }, [])

  // Mapear datos a widgets
  const widgetData = useMemo(() => {
    if (!data) return {}
    return {
      "stats-revenue": data.revenue,
      "stats-contacts": data.contacts,
      "stats-leads": data.leads,
      "stats-tasks": data.tasks,
      "list-pending-tasks": data.tasks,
      "list-recent-contacts": data.recentContacts,
    }
  }, [data])

  if (!config) {
    return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-pulse">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-32 bg-muted rounded-lg" />
      ))}
    </div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DashboardCustomizer config={config} onConfigChange={handleConfigChange} />
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {config.widgets.map((widget) => (
          <WidgetRenderer 
            key={widget.id} 
            widget={widget} 
            data={widgetData[widget.type as keyof typeof widgetData]} 
          />
        ))}
      </div>
    </div>
  )
}
