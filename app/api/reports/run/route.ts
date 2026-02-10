import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"
import { z } from "zod"
import crypto from "crypto"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 30 }
const MAX_ROWS = 5000

const ENTITY_DEFS = {
  contacts: {
    table: "contacts",
    select: "id, created_at, lead_status, source, lead_score, assigned_to, created_by",
    allowedMetrics: new Set(["count", "lead_score_avg", "conversion_rate"]),
    allowedGroupBy: new Set(["lead_status", "lead_source", "owner_id", "created_month"]),
    filterFieldMap: {
      // Friendly aliases used by UI/docs:
      lead_source: "source",
      owner_id: "assigned_to",
      // Raw DB fields:
      lead_status: "lead_status",
      source: "source",
      assigned_to: "assigned_to",
      created_by: "created_by",
      email: "email",
      name: "name",
      phone: "phone",
      country: "country",
      city: "city",
    } as Record<string, string>,
  },
  opportunities: {
    table: "opportunities",
    // Include stage name for grouping by "stage"
    select: "id, created_at, expected_close_date, expected_revenue, probability, status, stage_id, created_by, assigned_to, contact_id, stage:pipeline_stages(name)",
    allowedMetrics: new Set(["count", "value_sum", "value_avg", "win_rate", "weighted_value"]),
    allowedGroupBy: new Set(["stage", "owner_id", "created_month", "close_month"]),
    filterFieldMap: {
      owner_id: "created_by",
      status: "status",
      stage_id: "stage_id",
      contact_id: "contact_id",
      created_by: "created_by",
      assigned_to: "assigned_to",
      name: "name",
    } as Record<string, string>,
  },
  invoices: {
    table: "invoices",
    select: "id, created_at, status, total, contact_id, invoice_number, issue_date, due_date, created_by",
    allowedMetrics: new Set(["count", "total_sum", "paid_sum", "pending_sum"]),
    allowedGroupBy: new Set(["status", "created_month", "contact_id"]),
    filterFieldMap: {
      status: "status",
      contact_id: "contact_id",
      invoice_number: "invoice_number",
      created_by: "created_by",
    } as Record<string, string>,
  },
  tasks: {
    table: "tasks",
    select: "id, created_at, status, priority, assigned_to, due_date, created_by",
    allowedMetrics: new Set(["count", "completed_count", "completion_rate"]),
    allowedGroupBy: new Set(["status", "priority", "assigned_to", "due_month"]),
    filterFieldMap: {
      status: "status",
      priority: "priority",
      assigned_to: "assigned_to",
      created_by: "created_by",
    } as Record<string, string>,
  },
} as const

const reportConfigSchema = z.object({
  entity: z.enum(["contacts", "opportunities", "invoices", "tasks"]),
  metrics: z.array(z.string()).min(1).max(10),
  groupBy: z.string().min(1).max(50),
  dateRange: z.string().min(1).max(50),
  filters: z
    .array(
      z.object({
        field: z.string().min(1).max(50),
        operator: z.string().optional(),
        value: z.string().min(1).max(200),
      })
    )
    .max(10)
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const log = createRequestLogger(request)
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()
    const rawConfig = await request.json()
    const parsed = reportConfigSchema.safeParse(rawConfig)

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Configuración de reporte inválida", details: parsed.error.errors },
        { status: 400 }
      )
    }

    const config = parsed.data

    const { entity, metrics, groupBy, dateRange, filters } = config
    const def = ENTITY_DEFS[entity]

    if (!def.allowedGroupBy.has(groupBy)) {
      return NextResponse.json(
        { success: false, error: `groupBy no permitido para entidad '${entity}'` },
        { status: 400 }
      )
    }

    for (const metric of metrics) {
      if (!def.allowedMetrics.has(metric)) {
        return NextResponse.json(
          { success: false, error: `Métrica no permitida: ${metric}` },
          { status: 400 }
        )
      }
    }

    // Build date filter
    const dateFilter = getDateFilter(dateRange)

    // Build query based on entity
    let query: any = supabase
      .from(def.table)
      .select(def.select)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(0, MAX_ROWS - 1)

    if (dateFilter.start) {
      query = query.gte("created_at", dateFilter.start)
    }
    if (dateFilter.end) {
      query = query.lte("created_at", dateFilter.end)
    }

    // Apply custom filters
    for (const filter of filters || []) {
      const field = filter.field?.trim()
      const value = filter.value?.trim()
      if (!field || !value) continue

      const mapped = def.filterFieldMap[field]
      if (!mapped) {
        return NextResponse.json(
          { success: false, error: `Filtro no permitido para '${entity}': ${field}` },
          { status: 400 }
        )
      }

      query = query.eq(mapped, value)
    }

    log.info("Running report query", { organizationId, entity, groupBy, dateRange, filters })

    // Log the generated SQL query (simulated)
    // console.log("Query builder state:", query) 

    const { data, error } = await query

    if (error) {
      log.error("Supabase query error in reports/run", error, { organizationId, entity })
      throw error
    }

    log.info("Report query completed", { organizationId, entity, rows: data?.length || 0 })

    // Process data for report
    const result = processReportData(data || [], metrics, groupBy, entity)

    return NextResponse.json({ success: true, data: result })

  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error("Error in /api/reports/run", error)

    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/reports/run",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

function getDateFilter(dateRange: string): { start?: string; end?: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (dateRange) {
    case "today":
      return { start: today.toISOString(), end: now.toISOString() }
    case "yesterday":
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { start: yesterday.toISOString(), end: today.toISOString() }
    case "this_week":
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      return { start: weekStart.toISOString(), end: now.toISOString() }
    case "last_week":
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay())
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      return { start: lastWeekStart.toISOString(), end: lastWeekEnd.toISOString() }
    case "this_month":
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: monthStart.toISOString(), end: now.toISOString() }
    case "last_month":
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: lastMonthStart.toISOString(), end: lastMonthEnd.toISOString() }
    case "this_quarter":
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return { start: quarterStart.toISOString(), end: now.toISOString() }
    case "this_year":
      const yearStart = new Date(now.getFullYear(), 0, 1)
      return { start: yearStart.toISOString(), end: now.toISOString() }
    case "last_year":
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31)
      return { start: lastYearStart.toISOString(), end: lastYearEnd.toISOString() }
    default:
      return {}
  }
}

function processReportData(data: any[], metrics: string[], groupBy: string, entity: string) {
  // Group data
  const grouped: Record<string, any[]> = {}

  for (const item of data) {
    let groupKey: any = "Sin asignar"

    if (groupBy === "lead_source") {
      groupKey = item.source || "Sin asignar"
    } else if (groupBy === "owner_id") {
      // contacts: assigned_to is the owner; opportunities: created_by is the owner
      groupKey = (entity === "contacts" ? item.assigned_to : item.created_by) || "Sin asignar"
    } else if (groupBy === "stage") {
      groupKey = item?.stage?.name || item.stage_id || "Sin asignar"
    } else {
      groupKey = item[groupBy] || "Sin asignar"
    }

    // Handle date grouping
    if (groupBy.includes("month") || groupBy.includes("_month")) {
      const dateField = groupBy.replace("_month", "") === "created" ? "created_at" :
        groupBy.replace("_month", "") === "close" ? "expected_close_date" :
          groupBy.replace("_month", "") === "due" ? "due_date" : "created_at"
      const date = new Date(item[dateField])
      groupKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    }

    if (!grouped[groupKey]) grouped[groupKey] = []
    grouped[groupKey].push(item)
  }

  // Calculate metrics for each group
  const rows: any[] = []
  const columns = [groupBy, ...metrics]

  for (const [key, items] of Object.entries(grouped)) {
    const row: Record<string, unknown> = { [groupBy]: key }

    for (const metric of metrics) {
      row[metric] = calculateMetric(items, metric)
    }

    rows.push(row)
  }

  // Sort by first metric descending
  rows.sort((a, b) => (b[metrics[0]] || 0) - (a[metrics[0]] || 0))

  // Calculate summary
  const summary = metrics.map(metric => ({
    label: getMetricLabel(metric),
    value: formatMetricValue(calculateMetric(data, metric), metric),
  }))

  // Use entity for potential future enhancements
  void entity

  return { columns, rows, summary, total: data.length }
}

function calculateMetric(items: any[], metric: string): number {
  const getValue = (i: any) =>
    Number(i.expected_revenue ?? i.value ?? i.total ?? 0)

  switch (metric) {
    case "count":
      return items.length
    case "value_sum":
    case "total_sum":
      return items.reduce((sum, i) => sum + getValue(i), 0)
    case "value_avg":
      return items.length ? items.reduce((sum, i) => sum + getValue(i), 0) / items.length : 0
    case "lead_score_avg":
      return items.length ? items.reduce((sum, i) => sum + (i.lead_score || 0), 0) / items.length : 0
    case "weighted_value":
      return items.reduce((sum, i) => sum + getValue(i) * (i.probability || 0) / 100, 0)
    case "win_rate":
      // Prefer the canonical status enum when available.
      const won = items.filter(i => i.status === "won" || i?.stage?.name === "Ganado").length
      return items.length ? (won / items.length) * 100 : 0
    case "paid_sum":
      return items.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.total || 0), 0)
    case "pending_sum":
      return items.filter(i => i.status !== "paid").reduce((sum, i) => sum + Number(i.total || 0), 0)
    case "completed_count":
      return items.filter(i => i.status === "completed").length
    case "completion_rate":
      const completed = items.filter(i => i.status === "completed").length
      return items.length ? (completed / items.length) * 100 : 0
    case "conversion_rate":
      const converted = items.filter(i => i.lead_status === "converted").length
      return items.length ? (converted / items.length) * 100 : 0
    default:
      return 0
  }
}

function getMetricLabel(metric: string): string {
  const labels: Record<string, string> = {
    count: "Total",
    value_sum: "Valor Total",
    value_avg: "Valor Promedio",
    total_sum: "Total Facturado",
    paid_sum: "Total Cobrado",
    pending_sum: "Pendiente",
    weighted_value: "Valor Ponderado",
    win_rate: "Tasa de Cierre",
    lead_score_avg: "Score Promedio",
    completed_count: "Completadas",
    completion_rate: "% Completado",
    conversion_rate: "% Conversión",
  }
  return labels[metric] || metric
}

function formatMetricValue(value: number, metric: string): string {
  if (metric.includes("rate") || metric.includes("_avg") && metric !== "value_avg") {
    return `${value.toFixed(1)}%`
  }
  if (metric.includes("value") || metric.includes("sum") || metric.includes("total")) {
    return `S/ ${value.toLocaleString("es-PE", { minimumFractionDigits: 2 })}`
  }
  return value.toLocaleString("es-PE")
}
