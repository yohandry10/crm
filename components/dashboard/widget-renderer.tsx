"use client"

import { memo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DashboardWidget, WidgetType } from "@/lib/dashboard-config"
import { DollarSign, Users, Target, CheckSquare, TrendingUp, Calendar, Zap } from "lucide-react"

interface WidgetRendererProps {
  widget: DashboardWidget
  data?: any
}

// Memoizado para evitar re-renders innecesarios
export const WidgetRenderer = memo(function WidgetRenderer({ widget, data }: WidgetRendererProps) {
  const sizeClasses = {
    small: "col-span-1",
    medium: "col-span-2",
    large: "col-span-2 lg:col-span-3",
  }

  return (
    <Card className={sizeClasses[widget.size]}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <WidgetIcon type={widget.type} />
          {widget.title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <WidgetContent type={widget.type} data={data} />
      </CardContent>
    </Card>
  )
})

const WidgetIcon = memo(function WidgetIcon({ type }: { type: WidgetType }) {
  const icons: Record<string, React.ReactNode> = {
    "stats-revenue": <DollarSign className="w-4 h-4 text-green-500" />,
    "stats-contacts": <Users className="w-4 h-4 text-blue-500" />,
    "stats-leads": <Target className="w-4 h-4 text-purple-500" />,
    "stats-tasks": <CheckSquare className="w-4 h-4 text-orange-500" />,
    "chart-sales": <TrendingUp className="w-4 h-4 text-primary" />,
    "chart-pipeline": <Target className="w-4 h-4 text-primary" />,
    "chart-revenue-trend": <TrendingUp className="w-4 h-4 text-green-500" />,
    "list-recent-contacts": <Users className="w-4 h-4 text-blue-500" />,
    "list-pending-tasks": <CheckSquare className="w-4 h-4 text-orange-500" />,
    "list-recent-invoices": <DollarSign className="w-4 h-4 text-green-500" />,
    "calendar-upcoming": <Calendar className="w-4 h-4 text-primary" />,
    "quick-actions": <Zap className="w-4 h-4 text-yellow-500" />,
  }
  return <>{icons[type] || null}</>
})

const WidgetContent = memo(function WidgetContent({ type, data }: { type: WidgetType; data?: any }) {
  switch (type) {
    case "stats-revenue":
      return (
        <div>
          <div className="text-2xl font-bold">S/ {(data?.revenue || 0).toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">+{data?.growth || 0}% vs mes anterior</p>
        </div>
      )
    case "stats-contacts":
      return (
        <div>
          <div className="text-2xl font-bold">{data?.total || 0}</div>
          <p className="text-xs text-muted-foreground">+{data?.new || 0} este mes</p>
        </div>
      )
    case "stats-leads":
      return (
        <div>
          <div className="text-2xl font-bold">{data?.active || 0}</div>
          <p className="text-xs text-muted-foreground">{data?.qualified || 0} calificados</p>
        </div>
      )
    case "stats-tasks":
      return (
        <div>
          <div className="text-2xl font-bold">{data?.pending || 0}</div>
          <p className="text-xs text-muted-foreground">{data?.overdue || 0} vencidas</p>
        </div>
      )
    case "list-pending-tasks":
      return (
        <div className="space-y-2">
          {(data?.tasks || []).slice(0, 5).map((task: any) => (
            <div key={task.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{task.title}</span>
              <span className="text-xs text-muted-foreground">{task.due_date}</span>
            </div>
          ))}
          {(!data?.tasks || data.tasks.length === 0) && (
            <p className="text-sm text-muted-foreground">No hay tareas pendientes</p>
          )}
        </div>
      )
    case "list-recent-contacts":
      return (
        <div className="space-y-2">
          {(data?.contacts || []).slice(0, 5).map((contact: any) => (
            <div key={contact.id} className="flex items-center justify-between text-sm">
              <span className="truncate">{contact.name}</span>
              <span className="text-xs text-muted-foreground">{contact.company}</span>
            </div>
          ))}
          {(!data?.contacts || data.contacts.length === 0) && (
            <p className="text-sm text-muted-foreground">No hay contactos recientes</p>
          )}
        </div>
      )
    case "quick-actions":
      return (
        <div className="grid grid-cols-2 gap-2">
          <button className="p-2 text-xs bg-primary/10 rounded hover:bg-primary/20 transition">
            + Contacto
          </button>
          <button className="p-2 text-xs bg-primary/10 rounded hover:bg-primary/20 transition">
            + Lead
          </button>
          <button className="p-2 text-xs bg-primary/10 rounded hover:bg-primary/20 transition">
            + Tarea
          </button>
          <button className="p-2 text-xs bg-primary/10 rounded hover:bg-primary/20 transition">
            + Factura
          </button>
        </div>
      )
    default:
      return <div className="h-32 flex items-center justify-center text-muted-foreground">Widget: {type}</div>
  }
})
