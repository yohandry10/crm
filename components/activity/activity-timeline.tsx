"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Plus, Edit, Trash2, Eye, Download, Upload, LogIn,
  User, Building2, DollarSign, FileText, CheckSquare, Ticket,
  RefreshCw, ChevronDown
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

interface ActivityLog {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  description: string | null
  changes: Record<string, { old: any; new: any }> | null
  metadata: Record<string, any> | null
  created_at: string
  profiles: {
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

interface ActivityTimelineProps {
  entityType?: string
  entityId?: string
  limit?: number
  showFilters?: boolean
  title?: string
  compact?: boolean
}

const actionIcons: Record<string, any> = {
  create: Plus,
  update: Edit,
  delete: Trash2,
  view: Eye,
  export: Download,
  import: Upload,
  login: LogIn,
}

const actionColors: Record<string, string> = {
  create: "bg-green-100 text-green-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  view: "bg-gray-100 text-gray-700",
  export: "bg-purple-100 text-purple-700",
  import: "bg-orange-100 text-orange-700",
  login: "bg-cyan-100 text-cyan-700",
}

const entityIcons: Record<string, any> = {
  contact: User,
  account: Building2,
  opportunity: DollarSign,
  invoice: FileText,
  task: CheckSquare,
  ticket: Ticket,
}

const actionLabels: Record<string, string> = {
  create: "Creó",
  update: "Actualizó",
  delete: "Eliminó",
  view: "Vio",
  export: "Exportó",
  import: "Importó",
  login: "Inició sesión",
}

const entityLabels: Record<string, string> = {
  contact: "contacto",
  account: "cuenta",
  opportunity: "oportunidad",
  invoice: "factura",
  task: "tarea",
  ticket: "ticket",
  product: "producto",
}

export function ActivityTimeline({
  entityType,
  entityId,
  limit = 20,
  showFilters = true,
  title = "Actividad Reciente",
  compact = false,
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAction, setFilterAction] = useState<string>("all")
  const [filterEntity, setFilterEntity] = useState<string>(entityType || "all")
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    loadActivities(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterAction, filterEntity, entityType, entityId])

  const loadActivities = async (reset = false) => {
    if (reset) {
      setOffset(0)
      setLoading(true)
    }

    try {
      const params = new URLSearchParams()
      params.set("limit", String(limit))
      params.set("offset", String(reset ? 0 : offset))

      if (entityType || (filterEntity && filterEntity !== "all")) {
        params.set("entity_type", entityType || filterEntity)
      }
      if (entityId) {
        params.set("entity_id", entityId)
      }
      if (filterAction && filterAction !== "all") {
        params.set("action", filterAction)
      }

      const res = await fetch(`/api/activity?${params}`)
      const json = await res.json()

      if (json.success) {
        if (reset) {
          setActivities(json.data)
        } else {
          setActivities(prev => [...prev, ...json.data])
        }
        setHasMore(json.data.length === limit)
        setOffset(reset ? limit : offset + limit)
      }
    } catch (error) {
      console.error("Error loading activities:", error)
    } finally {
      setLoading(false)
    }
  }

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
    }
    return email[0].toUpperCase()
  }

  const formatTime = (date: string) => {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
  }

  const renderChanges = (changes: Record<string, { old: any; new: any }>) => {
    return (
      <div className="mt-2 text-xs space-y-1">
        {Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
          <div key={field} className="flex items-center gap-2 text-muted-foreground">
            <span className="font-medium">{field}:</span>
            <span className="line-through text-red-500">{String(oldVal || "-")}</span>
            <span>→</span>
            <span className="text-green-600">{String(newVal || "-")}</span>
          </div>
        ))}
      </div>
    )
  }

  if (loading && activities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => loadActivities(true)}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {showFilters && !entityId && (
          <div className="flex gap-2 mt-2">
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Acción" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="create">Creaciones</SelectItem>
                <SelectItem value="update">Actualizaciones</SelectItem>
                <SelectItem value="delete">Eliminaciones</SelectItem>
              </SelectContent>
            </Select>

            {!entityType && (
              <Select value={filterEntity} onValueChange={setFilterEntity}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="Entidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="contact">Contactos</SelectItem>
                  <SelectItem value="opportunity">Oportunidades</SelectItem>
                  <SelectItem value="invoice">Facturas</SelectItem>
                  <SelectItem value="task">Tareas</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No hay actividad registrada
          </p>
        ) : (
          <ScrollArea className={compact ? "h-[300px]" : "h-[500px]"}>
            <div className="space-y-4 pr-4">
              {activities.map((activity, index) => {
                const ActionIcon = actionIcons[activity.action] || Edit
                const _EntityIcon = entityIcons[activity.entity_type] || User
                const actionColor = actionColors[activity.action] || actionColors.update

                return (
                  <div key={activity.id} className="flex gap-3 relative">
                    {/* Timeline line */}
                    {index < activities.length - 1 && (
                      <div className="absolute left-5 top-10 w-0.5 h-full bg-muted -z-10" />
                    )}

                    {/* Avatar */}
                    <Avatar className="w-10 h-10 flex-shrink-0">
                      <AvatarImage src={activity.profiles?.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(
                          activity.profiles?.full_name || null,
                          activity.profiles?.email || "U"
                        )}
                      </AvatarFallback>
                    </Avatar>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm">
                            <span className="font-medium">
                              {activity.profiles?.full_name || activity.profiles?.email || "Usuario"}
                            </span>
                            {" "}
                            <span className="text-muted-foreground">
                              {activity.description || 
                                `${actionLabels[activity.action] || activity.action} ${
                                  entityLabels[activity.entity_type] || activity.entity_type
                                }${activity.entity_name ? ` "${activity.entity_name}"` : ""}`
                              }
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatTime(activity.created_at)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${actionColor}`}>
                            <ActionIcon className="w-3 h-3 mr-1" />
                            {actionLabels[activity.action] || activity.action}
                          </Badge>
                        </div>
                      </div>

                      {/* Changes detail */}
                      {activity.changes && Object.keys(activity.changes).length > 0 && (
                        renderChanges(activity.changes)
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Load more */}
              {hasMore && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => loadActivities(false)}
                    disabled={loading}
                  >
                    {loading ? "Cargando..." : "Cargar más"}
                    <ChevronDown className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
