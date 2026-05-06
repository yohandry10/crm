import { z } from "zod"

export const reportDateRangeSchema = z.enum([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
  "this_year",
  "last_year",
  "all_time",
])

export const REPORT_ENTITY_DEFS = {
  contacts: {
    table: "contacts",
    select: "id, created_at, lead_status, source, lead_score, assigned_to, created_by",
    allowedMetrics: ["count", "lead_score_avg", "conversion_rate"],
    allowedGroupBy: ["lead_status", "lead_source", "owner_id", "created_month"],
    filterFieldMap: {
      lead_source: "source",
      owner_id: "assigned_to",
      lead_status: "lead_status",
      source: "source",
      assigned_to: "assigned_to",
      created_by: "created_by",
      email: "email",
      name: "name",
      phone: "phone",
      country: "country",
      city: "city",
    },
  },
  opportunities: {
    table: "opportunities",
    select: "id, created_at, expected_close_date, expected_revenue, probability, status, stage_id, created_by, assigned_to, contact_id, stage:pipeline_stages(name)",
    allowedMetrics: ["count", "value_sum", "value_avg", "win_rate", "weighted_value"],
    allowedGroupBy: ["stage", "owner_id", "created_month", "close_month"],
    filterFieldMap: {
      owner_id: "created_by",
      status: "status",
      stage_id: "stage_id",
      contact_id: "contact_id",
      created_by: "created_by",
      assigned_to: "assigned_to",
      name: "name",
    },
  },
  invoices: {
    table: "invoices",
    select: "id, created_at, status, total, contact_id, invoice_number, issue_date, due_date, created_by",
    allowedMetrics: ["count", "total_sum", "paid_sum", "pending_sum"],
    allowedGroupBy: ["status", "created_month", "contact_id"],
    filterFieldMap: {
      status: "status",
      contact_id: "contact_id",
      invoice_number: "invoice_number",
      created_by: "created_by",
    },
  },
  tasks: {
    table: "tasks",
    select: "id, created_at, status, priority, assigned_to, due_date, created_by",
    allowedMetrics: ["count", "completed_count", "completion_rate"],
    allowedGroupBy: ["status", "priority", "assigned_to", "due_month"],
    filterFieldMap: {
      status: "status",
      priority: "priority",
      assigned_to: "assigned_to",
      created_by: "created_by",
    },
  },
} as const

export const reportConfigSchema = z.object({
  name: z.string().trim().min(1).max(100).default("Reporte"),
  type: z.enum(["bar", "line", "pie", "table"]).default("table"),
  entity: z.enum(["contacts", "opportunities", "invoices", "tasks"]),
  metrics: z.array(z.string().min(1).max(50)).min(1).max(10),
  groupBy: z.string().min(1).max(50),
  dateRange: reportDateRangeSchema,
  filters: z
    .array(
      z.object({
        field: z.string().trim().min(1).max(50),
        operator: z.enum(["equals"]).optional().default("equals"),
        value: z.string().trim().min(1).max(200),
      })
    )
    .max(10)
    .optional()
    .default([]),
}).superRefine((config, ctx) => {
  const def = REPORT_ENTITY_DEFS[config.entity]

  if (!def.allowedGroupBy.includes(config.groupBy as never)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["groupBy"],
      message: `groupBy no permitido para entidad '${config.entity}'`,
    })
  }

  for (const metric of config.metrics) {
    if (!def.allowedMetrics.includes(metric as never)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metrics"],
        message: `Métrica no permitida: ${metric}`,
      })
    }
  }

  for (const filter of config.filters || []) {
    if (!def.filterFieldMap[filter.field as keyof typeof def.filterFieldMap]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["filters"],
        message: `Filtro no permitido para '${config.entity}': ${filter.field}`,
      })
    }
  }
})

export type ReportConfig = z.infer<typeof reportConfigSchema>

export function getReportDateFilter(dateRange: ReportConfig["dateRange"]): { start?: string; end?: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (dateRange) {
    case "today":
      return { start: today.toISOString(), end: now.toISOString() }
    case "yesterday": {
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      return { start: yesterday.toISOString(), end: today.toISOString() }
    }
    case "this_week": {
      const weekStart = new Date(today)
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      return { start: weekStart.toISOString(), end: now.toISOString() }
    }
    case "last_week": {
      const lastWeekEnd = new Date(today)
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay())
      const lastWeekStart = new Date(lastWeekEnd)
      lastWeekStart.setDate(lastWeekStart.getDate() - 7)
      return { start: lastWeekStart.toISOString(), end: lastWeekEnd.toISOString() }
    }
    case "this_month": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: monthStart.toISOString(), end: now.toISOString() }
    }
    case "last_month": {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: lastMonthStart.toISOString(), end: lastMonthEnd.toISOString() }
    }
    case "this_quarter": {
      const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      return { start: quarterStart.toISOString(), end: now.toISOString() }
    }
    case "last_quarter": {
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const startMonth = (currentQuarter - 1) * 3
      const lastQuarterStart = new Date(now.getFullYear(), startMonth, 1)
      const lastQuarterEnd = new Date(now.getFullYear(), startMonth + 3, 0)
      return { start: lastQuarterStart.toISOString(), end: lastQuarterEnd.toISOString() }
    }
    case "this_year": {
      const yearStart = new Date(now.getFullYear(), 0, 1)
      return { start: yearStart.toISOString(), end: now.toISOString() }
    }
    case "last_year": {
      const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
      const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31)
      return { start: lastYearStart.toISOString(), end: lastYearEnd.toISOString() }
    }
    case "all_time":
      return {}
  }
}
