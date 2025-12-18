import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"
import crypto from "crypto"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

export async function POST(request: NextRequest) {
  try {
    const log = createRequestLogger(request)
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()
    const config = await request.json()

    const { entity, metrics, groupBy, dateRange, filters } = config

    // Build date filter
    const dateFilter = getDateFilter(dateRange)

    // Build query based on entity
    let query: any = supabase.from(entity).select("*").eq("organization_id", organizationId)

    if (dateFilter.start) {
      query = query.gte("created_at", dateFilter.start)
    }
    if (dateFilter.end) {
      query = query.lte("created_at", dateFilter.end)
    }

    // Apply custom filters
    for (const filter of filters || []) {
      if (filter.field && filter.value) {
        query = query.eq(filter.field, filter.value)
      }
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
      { success: false, error: sanitizeErrorForClient(error), details: error.message },
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
    let groupKey = item[groupBy] || "Sin asignar"

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
  switch (metric) {
    case "count":
      return items.length
    case "value_sum":
    case "total_sum":
      return items.reduce((sum, i) => sum + (i.value || i.total || 0), 0)
    case "value_avg":
      return items.length ? items.reduce((sum, i) => sum + (i.value || 0), 0) / items.length : 0
    case "lead_score_avg":
      return items.length ? items.reduce((sum, i) => sum + (i.lead_score || 0), 0) / items.length : 0
    case "weighted_value":
      return items.reduce((sum, i) => sum + (i.value || 0) * (i.probability || 0) / 100, 0)
    case "win_rate":
      const won = items.filter(i => i.stage === "closed_won").length
      return items.length ? (won / items.length) * 100 : 0
    case "paid_sum":
      return items.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.total || 0), 0)
    case "pending_sum":
      return items.filter(i => i.status !== "paid").reduce((sum, i) => sum + (i.total || 0), 0)
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
