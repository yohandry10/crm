"use client"

export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Download,
  Save,
  Play,
  Plus,
  Trash2,
  Calendar,
  Users,
  Target,
  FileText,
  Loader2,
} from "lucide-react"

interface ReportConfig {
  id?: string
  name: string
  type: "bar" | "line" | "pie" | "table"
  entity: string
  metrics: string[]
  groupBy: string
  dateRange: string
  filters: { field: string; operator: string; value: string }[]
}

const ENTITIES = [
  { id: "contacts", name: "Contactos", icon: Users },
  { id: "opportunities", name: "Oportunidades", icon: Target },
  { id: "invoices", name: "Facturas", icon: FileText },
  { id: "tasks", name: "Tareas", icon: Calendar },
]

const METRICS = {
  contacts: [
    { id: "count", name: "Cantidad" },
    { id: "lead_score_avg", name: "Score promedio" },
    { id: "conversion_rate", name: "Tasa de conversión" },
  ],
  opportunities: [
    { id: "count", name: "Cantidad" },
    { id: "value_sum", name: "Valor total" },
    { id: "value_avg", name: "Valor promedio" },
    { id: "win_rate", name: "Tasa de cierre" },
    { id: "weighted_value", name: "Valor ponderado" },
  ],
  invoices: [
    { id: "count", name: "Cantidad" },
    { id: "total_sum", name: "Total facturado" },
    { id: "paid_sum", name: "Total cobrado" },
    { id: "pending_sum", name: "Pendiente de cobro" },
  ],
  tasks: [
    { id: "count", name: "Cantidad" },
    { id: "completed_count", name: "Completadas" },
    { id: "completion_rate", name: "Tasa de completado" },
  ],
}

const GROUP_BY = {
  contacts: [
    { id: "lead_status", name: "Estado" },
    { id: "lead_source", name: "Fuente" },
    { id: "owner_id", name: "Vendedor" },
    { id: "created_month", name: "Mes de creación" },
  ],
  opportunities: [
    { id: "stage", name: "Etapa" },
    { id: "owner_id", name: "Vendedor" },
    { id: "created_month", name: "Mes de creación" },
    { id: "close_month", name: "Mes de cierre" },
  ],
  invoices: [
    { id: "status", name: "Estado" },
    { id: "created_month", name: "Mes" },
    { id: "contact_id", name: "Cliente" },
  ],
  tasks: [
    { id: "status", name: "Estado" },
    { id: "priority", name: "Prioridad" },
    { id: "assigned_to", name: "Asignado a" },
    { id: "due_month", name: "Mes de vencimiento" },
  ],
}

const DATE_RANGES = [
  { id: "today", name: "Hoy" },
  { id: "yesterday", name: "Ayer" },
  { id: "this_week", name: "Esta semana" },
  { id: "last_week", name: "Semana pasada" },
  { id: "this_month", name: "Este mes" },
  { id: "last_month", name: "Mes pasado" },
  { id: "this_quarter", name: "Este trimestre" },
  { id: "last_quarter", name: "Trimestre pasado" },
  { id: "this_year", name: "Este año" },
  { id: "last_year", name: "Año pasado" },
  { id: "all_time", name: "Todo el tiempo" },
]

export default function ReportBuilderPage() {
  const [savedReports, setSavedReports] = useState<ReportConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [config, setConfig] = useState<ReportConfig>({
    name: "Nuevo Reporte",
    type: "bar",
    entity: "opportunities",
    metrics: ["count", "value_sum"],
    groupBy: "stage",
    dateRange: "this_month",
    filters: [],
  })

  useEffect(() => {
    fetchSavedReports()
  }, [])

  const fetchSavedReports = async () => {
    try {
      const res = await fetch("/api/reports/saved")
      if (res.ok) {
        const data = await res.json()
        setSavedReports(data.data || [])
      }
    } catch (error) {
      console.error(error)
    }
  }

  const runReport = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/reports/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      if (!res.ok) throw new Error("Failed to run report")

      const data = await res.json()
      setReportData(data.data)
      toast.success("Reporte generado")
    } catch (error) {
      toast.error("Error al generar reporte")
    } finally {
      setLoading(false)
    }
  }

  const saveReport = async () => {
    try {
      const res = await fetch("/api/reports/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      if (!res.ok) throw new Error("Failed to save")

      toast.success("Reporte guardado")
      fetchSavedReports()
    } catch (error) {
      toast.error("Error al guardar")
    }
  }

  const exportReport = async (format: "csv" | "xlsx" | "pdf") => {
    if (!reportData) {
      toast.error("Primero genera el reporte")
      return
    }

    try {
      const res = await fetch(`/api/reports/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, data: reportData }),
      })

      if (!res.ok) throw new Error("Failed to export")

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${config.name}.${format}`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`Exportado como ${format.toUpperCase()}`)
    } catch (error) {
      toast.error("Error al exportar")
    }
  }

  const addFilter = () => {
    setConfig({
      ...config,
      filters: [...config.filters, { field: "", operator: "equals", value: "" }],
    })
  }

  const removeFilter = (index: number) => {
    setConfig({
      ...config,
      filters: config.filters.filter((_, i) => i !== index),
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Constructor de Reportes</h1>
            <p className="text-muted-foreground">
              Crea reportes personalizados con métricas y filtros
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveReport}>
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
            <Button onClick={runReport} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Ejecutar
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Config Panel */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del reporte</Label>
                <Input
                  value={config.name}
                  onChange={(e) => setConfig({ ...config, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Entidad</Label>
                <Select
                  value={config.entity}
                  onValueChange={(v) => setConfig({
                    ...config,
                    entity: v,
                    metrics: [METRICS[v as keyof typeof METRICS][0].id],
                    groupBy: GROUP_BY[v as keyof typeof GROUP_BY][0].id,
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITIES.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de gráfico</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "bar", icon: BarChart3 },
                    { id: "line", icon: TrendingUp },
                    { id: "pie", icon: PieChart },
                    { id: "table", icon: FileText },
                  ].map((t) => (
                    <Button
                      key={t.id}
                      variant={config.type === t.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setConfig({ ...config, type: t.id as any })}
                    >
                      <t.icon className="w-4 h-4" />
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Métricas</Label>
                <div className="flex flex-wrap gap-2">
                  {METRICS[config.entity as keyof typeof METRICS]?.map((m) => (
                    <Badge
                      key={m.id}
                      variant={config.metrics.includes(m.id) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        const metrics = config.metrics.includes(m.id)
                          ? config.metrics.filter((x) => x !== m.id)
                          : [...config.metrics, m.id]
                        setConfig({ ...config, metrics })
                      }}
                    >
                      {m.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Agrupar por</Label>
                <Select
                  value={config.groupBy}
                  onValueChange={(v) => setConfig({ ...config, groupBy: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GROUP_BY[config.entity as keyof typeof GROUP_BY]?.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período</Label>
                <Select
                  value={config.dateRange}
                  onValueChange={(v) => setConfig({ ...config, dateRange: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Filtros</Label>
                  <Button variant="ghost" size="sm" onClick={addFilter}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {config.filters.map((filter, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Campo"
                      value={filter.field}
                      onChange={(e) => {
                        const filters = [...config.filters]
                        filters[i].field = e.target.value
                        setConfig({ ...config, filters })
                      }}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Valor"
                      value={filter.value}
                      onChange={(e) => {
                        const filters = [...config.filters]
                        filters[i].value = e.target.value
                        setConfig({ ...config, filters })
                      }}
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeFilter(i)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Resultados</CardTitle>
              {reportData && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => exportReport("csv")}>
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => exportReport("xlsx")}>
                    <Download className="w-4 h-4 mr-1" />
                    Excel
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {!reportData ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <BarChart3 className="w-12 h-12 mb-4 opacity-50" />
                  <p>Configura y ejecuta el reporte para ver resultados</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    {reportData.summary?.map((s: any, i: number) => (
                      <Card key={i}>
                        <CardContent className="pt-4">
                          <p className="text-sm text-muted-foreground">{s.label}</p>
                          <p className="text-2xl font-bold">{s.value}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Table */}
                  {reportData.rows && (
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted">
                          <tr>
                            {reportData.columns?.map((col: string) => (
                              <th key={col} className="px-4 py-2 text-left text-sm font-medium">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.rows.map((row: any, i: number) => (
                            <tr key={i} className="border-t">
                              {reportData.columns?.map((col: string) => (
                                <td key={col} className="px-4 py-2 text-sm">
                                  {row[col]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Saved Reports */}
        {savedReports.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Reportes Guardados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {savedReports.map((report) => (
                  <Card
                    key={report.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => setConfig(report)}
                  >
                    <CardContent className="pt-4">
                      <p className="font-medium">{report.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ENTITIES.find((e) => e.id === report.entity)?.name} • {report.type}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
