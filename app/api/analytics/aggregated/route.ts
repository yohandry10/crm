import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const period = searchParams.get("period") || "month"  // week, month, quarter, year
        const months_back = parseInt(searchParams.get("months_back") || "6")
        const metric = searchParams.get("metric")  // specific metric name

        // Si se solicita un metric específico con agregación custom
        if (metric) {
            const start_date = searchParams.get("start_date")
            const end_date = searchParams.get("end_date")

            if (!start_date || !end_date) {
                return NextResponse.json({
                    success: false,
                    error: "start_date and end_date required for specific metrics"
                }, { status: 400 })
            }

            const { data, error } = await supabase
                .rpc('aggregate_analytics_by_period', {
                    p_organization_id: organizationId,
                    p_metric_name: metric,
                    p_start_date: start_date,
                    p_end_date: end_date,
                    p_period: period
                })

            if (error) throw error

            return NextResponse.json({
                success: true,
                data: {
                    metric,
                    period,
                    aggregations: data || []
                }
            })
        }

        // Obtener métricas agregadas generales - MULTI-TENANT
        const { data, error } = await supabase
            .rpc('get_aggregated_metrics', {
                p_organization_id: organizationId,
                p_period: period,
                p_months_back: months_back
            })

        if (error) throw error

        // Formatear para gráficos
        const chartData = (data || []).map((row: any) => ({
            period: row.period_label,
            contacts: row.contacts_count,
            sales: parseFloat(row.sales_total || 0),
            invoices: row.invoices_count,
            date: row.period_start
        }))

        // Calcular totales y promedios
        const totals = {
            total_contacts: chartData.reduce((sum: number, d: any) => sum + d.contacts, 0),
            total_sales: chartData.reduce((sum: number, d: any) => sum + d.sales, 0),
            total_invoices: chartData.reduce((sum: number, d: any) => sum + d.invoices, 0),
            avg_contacts_per_period: chartData.length > 0
                ? Math.round(chartData.reduce((sum: number, d: any) => sum + d.contacts, 0) / chartData.length)
                : 0,
            avg_sales_per_period: chartData.length > 0
                ? Math.round(chartData.reduce((sum: number, d: any) => sum + d.sales, 0) / chartData.length)
                : 0
        }

        // Calcular tendencias (comparar últimos 2 períodos)
        const trends = chartData.length >= 2 ? {
            contacts_trend: calculateTrend(chartData[1].contacts, chartData[0].contacts),
            sales_trend: calculateTrend(chartData[1].sales, chartData[0].sales),
            invoices_trend: calculateTrend(chartData[1].invoices, chartData[0].invoices)
        } : null

        return NextResponse.json({
            success: true,
            data: {
                period,
                months_back,
                chart_data: chartData,
                totals,
                trends
            }
        })

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

function calculateTrend(previous: number, current: number): { percentage: number; direction: 'up' | 'down' | 'stable' } {
    if (previous === 0) {
        return { percentage: current > 0 ? 100 : 0, direction: current > 0 ? 'up' : 'stable' }
    }

    const percentage = ((current - previous) / previous) * 100

    return {
        percentage: Math.abs(parseFloat(percentage.toFixed(1))),
        direction: percentage > 0.5 ? 'up' : percentage < -0.5 ? 'down' : 'stable'
    }
}
