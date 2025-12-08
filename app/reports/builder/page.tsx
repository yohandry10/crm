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
  ArrowLeft,
} from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

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
      <div className="max-w-7xl mx-auto space-y-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Link
            href="/reports"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-cyan-600 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Reportes
          </Link>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
                Constructor de Reportes
              </h1>
              <p className="text-lg text-muted-foreground">
                Crea reportes personalizados con métricas y filtros
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={saveReport}
                className="bg-white/50 border-gray-200 hover:bg-white hover:text-cyan-600 transition-colors"
              >
                <Save className="w-4 h-4 mr-2" />
                Guardar
              </Button>
              <Button
                onClick={runReport}
                disabled={loading}
                className="gradient-neon border-0 text-white shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all"
              >
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Ejecutar
              </Button>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Config Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden h-full">
              <CardHeader className="border-b border-gray-100 bg-white/50">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Target className="w-5 h-5 text-purple-500" />
                  Configuración
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-6">
                <div className="space-y-2">
                  <Label>Nombre del reporte</Label>
                  <Input
                    value={config.name}
                    onChange={(e) => setConfig({ ...config, name: e.target.value })}
                    className="bg-white/50 border-gray-200 focus:border-purple-500 focus:ring-purple-500"
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
                    <SelectTrigger className="bg-white/50 border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ENTITIES.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          <div className="flex items-center gap-2">
                            <e.icon className="w-4 h-4" />
                            {e.name}
                          </div>
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
                        className={config.type === t.id ? "bg-gray-900 text-white hover:bg-gray-800" : "bg-white/50 hover:bg-white"}
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
                        className={`cursor-pointer transition-all ${config.metrics.includes(m.id) ? "bg-cyan-100 text-cyan-800 hover:bg-cyan-200 border-cyan-200" : "hover:bg-gray-100"}`}
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
                    <SelectTrigger className="bg-white/50 border-gray-200">
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
                    <SelectTrigger className="bg-white/50 border-gray-200">
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

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <Label>Filtros</Label>
                    <Button variant="ghost" size="sm" onClick={addFilter} className="hover:text-cyan-600">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {config.filters.map((filter, i) => (
                    <div key={i} className="flex gap-2 items-center mb-2">
                      <Input
                        placeholder="Campo"
                        value={filter.field}
                        onChange={(e) => {
                          const filters = [...config.filters]
                          filters[i].field = e.target.value
                          setConfig({ ...config, filters })
                        }}
                        className="flex-1 h-8 bg-white/50 text-xs"
                      />
                      <Input
                        placeholder="Valor"
                        value={filter.value}
                        onChange={(e) => {
                          const filters = [...config.filters]
                          filters[i].value = e.target.value
                          setConfig({ ...config, filters })
                        }}
                        className="flex-1 h-8 bg-white/50 text-xs"
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeFilter(i)} className="h-8 w-8 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  {config.filters.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">Sin filtros configurados</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Results Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden min-h-[500px]">
              <CardHeader className="flex flex-row items-center justify-between border-b border-gray-100 bg-white/50">
                <CardTitle className="text-xl flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-500" />
                  Resultados
                </CardTitle>
                {reportData && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => exportReport("csv")} className="bg-white/50 hover:bg-white hover:text-green-600">
                      <Download className="w-4 h-4 mr-1" />
                      CSV
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportReport("xlsx")} className="bg-white/50 hover:bg-white hover:text-green-600">
                      <Download className="w-4 h-4 mr-1" />
                      Excel
                    </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-6">
                {!reportData ? (
                  <div className="flex flex-col items-center justify-center h-96 text-muted-foreground bg-gray-50/30 rounded-lg border-2 border-dashed border-gray-200 m-4">
                    <BarChart3 className="w-16 h-16 mb-4 text-gray-300" />
                    <p className="text-lg font-medium text-gray-400">Configura y ejecuta el reporte para ver resultados</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {reportData.summary?.map((s: any, i: number) => (
                        <Card key={i} className="bg-white/80 border-0 shadow-sm">
                          <CardContent className="pt-6">
                            <p className="text-sm font-medium text-muted-foreground mb-1">{s.label}</p>
                            <p className="text-3xl font-bold text-gray-900">{s.value}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Table */}
                    {reportData.rows && (
                      <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm bg-white/80">
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead className="bg-gray-50/80">
                              <tr>
                                {reportData.columns?.map((col: string) => (
                                  <th key={col} className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {reportData.rows.map((row: any, i: number) => (
                                <tr key={i} className="hover:bg-cyan-50/20 transition-colors">
                                  {reportData.columns?.map((col: string) => (
                                    <td key={col} className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                                      {row[col]}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Saved Reports */}
        {savedReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md overflow-hidden">
              <CardHeader className="border-b border-gray-100 bg-white/50">
                <CardTitle className="text-lg">Reportes Guardados</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid md:grid-cols-3 gap-4">
                  {savedReports.map((report) => (
                    <Card
                      key={report.id}
                      className="cursor-pointer border-gray-100 hover:border-cyan-400 hover:shadow-md transition-all group bg-white/80"
                      onClick={() => setConfig(report)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900 group-hover:text-cyan-700 transition-colors">{report.name}</p>
                          <Badge variant="outline" className="bg-white">{report.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          {ENTITIES.find((e) => e.id === report.entity)?.icon ? (
                            (() => {
                              const Icon = ENTITIES.find((e) => e.id === report.entity)!.icon;
                              return <Icon className="w-3 h-3" />
                            })()
                          ) : null}
                          {ENTITIES.find((e) => e.id === report.entity)?.name}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}
