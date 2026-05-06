import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { getOrganizationTimezone } from "@/lib/date-utils"
import { z } from "zod"
import crypto from "crypto"

const querySchema = z.object({
    period: z.enum(["week", "month"]).default("month"),
    months_back: z.coerce.number().int().min(1).max(24).default(6),
    metric: z.string().trim().regex(/^[a-z0-9_:-]+$/i).max(64).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

function monthKey(date: Date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function weekKey(date: Date) {
    const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
    const days = Math.floor((date.getTime() - firstDay.getTime()) / 86400000)
    return `${date.getUTCFullYear()}-W${String(Math.ceil((days + firstDay.getUTCDay() + 1) / 7)).padStart(2, "0")}`
}

function getBucket(dateValue: string, period: "week" | "month") {
    const date = new Date(dateValue)
    return period === "week" ? weekKey(date) : monthKey(date)
}

function createBuckets(period: "week" | "month", monthsBack: number, start: Date) {
    const now = new Date()
    const buckets = new Map<string, { period: string; contacts: number; sales: number; invoices: number; date: string }>()

    if (period === "week") {
        const cursor = new Date(start)
        while (cursor <= now) {
            const key = weekKey(cursor)
            buckets.set(key, { period: key, contacts: 0, sales: 0, invoices: 0, date: cursor.toISOString().slice(0, 10) })
            cursor.setUTCDate(cursor.getUTCDate() + 7)
        }
        return buckets
    }

    for (let i = monthsBack - 1; i >= 0; i--) {
        const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
        const key = monthKey(date)
        buckets.set(key, { period: key, contacts: 0, sales: 0, invoices: 0, date: date.toISOString().slice(0, 10) })
    }

    return buckets
}

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const validation = querySchema.safeParse({
            period: request.nextUrl.searchParams.get("period") || undefined,
            months_back: request.nextUrl.searchParams.get("months_back") || undefined,
            metric: request.nextUrl.searchParams.get("metric") || undefined,
            start_date: request.nextUrl.searchParams.get("start_date") || undefined,
            end_date: request.nextUrl.searchParams.get("end_date") || undefined,
        })

        if (!validation.success) {
            throw new ValidationError("Filtros inválidos", validation.error.format())
        }

        const { period, months_back, metric, start_date, end_date } = validation.data
        const timezone = await getOrganizationTimezone(supabase, organizationId)

        if (metric) {
            if (!start_date || !end_date) {
                throw new ValidationError("start_date and end_date required for specific metrics")
            }

            const { data, error } = await supabase
                .from("analytics_cache")
                .select("metric_name, metric_value, period, date")
                .eq("organization_id", organizationId)
                .eq("metric_name", metric)
                .eq("period", period)
                .gte("date", start_date)
                .lte("date", end_date)
                .order("date", { ascending: true })

            if (error) throw error

            return NextResponse.json({
                success: true,
                data: {
                    metric,
                    period,
                    aggregations: data || [],
                },
            })
        }

        const start = new Date()
        start.setUTCMonth(start.getUTCMonth() - months_back + 1, 1)
        start.setUTCHours(0, 0, 0, 0)

        const [contacts, invoices] = await Promise.all([
            supabase
                .from("contacts")
                .select("id, created_at")
                .eq("organization_id", organizationId)
                .gte("created_at", start.toISOString()),
            supabase
                .from("invoices")
                .select("id, total, status, issue_date, created_at")
                .eq("organization_id", organizationId)
                .gte("created_at", start.toISOString()),
        ])

        if (contacts.error) throw contacts.error
        if (invoices.error) throw invoices.error

        const buckets = createBuckets(period, months_back, start)

        for (const contact of contacts.data || []) {
            const key = getBucket(contact.created_at, period)
            const bucket = buckets.get(key)
            if (bucket) bucket.contacts += 1
        }

        for (const invoice of invoices.data || []) {
            const key = getBucket(invoice.issue_date || invoice.created_at, period)
            const bucket = buckets.get(key)
            if (!bucket) continue
            bucket.invoices += 1
            if (invoice.status === "paid" || invoice.status === "sent") {
                bucket.sales += Number(invoice.total || 0)
            }
        }

        const chartData = Array.from(buckets.values())
        const totals = {
            total_contacts: chartData.reduce((sum, item) => sum + item.contacts, 0),
            total_sales: chartData.reduce((sum, item) => sum + item.sales, 0),
            total_invoices: chartData.reduce((sum, item) => sum + item.invoices, 0),
            avg_contacts_per_period: chartData.length ? Math.round(chartData.reduce((sum, item) => sum + item.contacts, 0) / chartData.length) : 0,
            avg_sales_per_period: chartData.length ? Math.round(chartData.reduce((sum, item) => sum + item.sales, 0) / chartData.length) : 0,
        }

        const trends = chartData.length >= 2 ? {
            contacts_trend: calculateTrend(chartData[chartData.length - 2].contacts, chartData[chartData.length - 1].contacts),
            sales_trend: calculateTrend(chartData[chartData.length - 2].sales, chartData[chartData.length - 1].sales),
            invoices_trend: calculateTrend(chartData[chartData.length - 2].invoices, chartData[chartData.length - 1].invoices),
        } : null

        const response = NextResponse.json({
            success: true,
            data: {
                period,
                months_back,
                timezone,
                chart_data: chartData,
                totals,
                trends,
            },
        })

        response.headers.set("Cache-Control", "private, max-age=600, stale-while-revalidate=120")
        response.headers.set("Vary", "Authorization, Cookie, X-Organization-ID")
        const cacheKey = crypto.createHash("sha256")
            .update(`analytics-aggregated:${organizationId}:${period}:${months_back}:${new Date().toISOString().split("T")[0]}`)
            .digest("hex")
        response.headers.set("X-Cache-Key", cacheKey)

        return response
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/analytics/aggregated",
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

function calculateTrend(previous: number, current: number): { percentage: number; direction: "up" | "down" | "stable" } {
    if (previous === 0) {
        return { percentage: current > 0 ? 100 : 0, direction: current > 0 ? "up" : "stable" }
    }

    const percentage = ((current - previous) / previous) * 100

    return {
        percentage: Math.abs(parseFloat(percentage.toFixed(1))),
        direction: percentage > 0.5 ? "up" : percentage < -0.5 ? "down" : "stable",
    }
}
