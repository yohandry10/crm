import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import crypto from 'crypto'

/**
 * GET /api/analytics/pipeline
 * Returns detailed pipeline metrics and stage analysis
 */
export async function GET(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const searchParams = request.nextUrl.searchParams
        const period = searchParams.get("period") || "month"

        // Calculate date range
        const now = new Date()
        const startDate = new Date()

        switch (period) {
            case "week": startDate.setDate(now.getDate() - 7); break
            case "month": startDate.setMonth(now.getMonth() - 1); break
            case "quarter": startDate.setMonth(now.getMonth() - 3); break
            case "year": startDate.setFullYear(now.getFullYear() - 1); break
        }

        // Fetch opportunities with stage details - MULTI-TENANT
        const { data: opportunities, error: oppError } = await supabase
            .from('opportunities')
            .select(`
                *,
                stage:pipeline_stages(id, name, win_probability, position),
                contact:contacts(id, name, company)
            `)
            .eq('organization_id', organizationId)
            .gte('created_at', startDate.toISOString())

        if (oppError) throw oppError

        const opportunitiesList = opportunities || []

        // Calculate metrics by status
        const byStatus = {
            open: opportunitiesList.filter(o => o.status === 'open'),
            won: opportunitiesList.filter(o => o.status === 'won'),
            lost: opportunitiesList.filter(o => o.status === 'lost')
        }

        // Calculate metrics by stage
        const byStage: { [key: string]: any } = {}
        opportunitiesList.forEach(opp => {
            if (opp.stage) {
                const stageName = opp.stage.name || 'Unknown'
                if (!byStage[stageName]) {
                    byStage[stageName] = {
                        name: stageName,
                        position: opp.stage.position,
                        win_probability: opp.stage.win_probability,
                        count: 0,
                        value: 0,
                        opportunities: []
                    }
                }
                byStage[stageName].count++
                byStage[stageName].value += Number(opp.expected_revenue || 0)
                byStage[stageName].opportunities.push({
                    id: opp.id,
                    name: opp.name,
                    value: opp.expected_revenue,
                    contact: opp.contact?.name
                })
            }
        })

        // Sort stages by position
        const stageMetrics = Object.values(byStage).sort((a, b) => a.position - b.position)

        // Calculate totals
        const totalValue = opportunitiesList.reduce((sum, o) => sum + Number(o.expected_revenue || 0), 0)
        const openValue = byStatus.open.reduce((sum, o) => sum + Number(o.expected_revenue || 0), 0)
        const wonValue = byStatus.won.reduce((sum, o) => sum + Number(o.expected_revenue || 0), 0)
        const lostValue = byStatus.lost.reduce((sum, o) => sum + Number(o.expected_revenue || 0), 0)

        // Calculate win rate (only closed opportunities)
        const closedOpps = byStatus.won.length + byStatus.lost.length
        const winRate = closedOpps > 0 ? (byStatus.won.length / closedOpps) * 100 : 0

        // Calculate average deal size
        const avgDealSize = opportunitiesList.length > 0 ? totalValue / opportunitiesList.length : 0

        // Weighted pipeline value (using stage probabilities)
        const weightedValue = opportunitiesList.reduce((sum, o) => {
            const probability = o.stage?.win_probability || 0
            return sum + (Number(o.expected_revenue || 0) * probability / 100)
        }, 0)

        // Velocity metrics (time to close)
        const wonWithDates = byStatus.won.filter(o => o.close_date && o.created_at)
        const avgTimeToClose = wonWithDates.length > 0
            ? wonWithDates.reduce((sum, o) => {
                const created = new Date(o.created_at).getTime()
                const closed = new Date(o.close_date).getTime()
                return sum + (closed - created)
            }, 0) / wonWithDates.length / (1000 * 60 * 60 * 24) // Convert to days
            : 0

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    total_opportunities: opportunitiesList.length,
                    open_count: byStatus.open.length,
                    won_count: byStatus.won.length,
                    lost_count: byStatus.lost.length,
                    total_value: totalValue,
                    open_value: openValue,
                    won_value: wonValue,
                    lost_value: lostValue,
                    weighted_value: weightedValue,
                    win_rate: Number(winRate.toFixed(2)),
                    avg_deal_size: Number(avgDealSize.toFixed(2)),
                    avg_time_to_close_days: Number(avgTimeToClose.toFixed(1))
                },
                by_stage: stageMetrics,
                by_status: {
                    open: { count: byStatus.open.length, value: openValue },
                    won: { count: byStatus.won.length, value: wonValue },
                    lost: { count: byStatus.lost.length, value: lostValue }
                }
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: '/api/analytics/pipeline',
            method: 'GET',
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
