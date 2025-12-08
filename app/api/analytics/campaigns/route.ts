import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import crypto from 'crypto'

/**
 * GET /api/analytics/campaigns
 * Returns detailed campaign metrics including ROI, lead generation, and conversion rates
 */
export async function GET(_request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        // Fetch campaigns with related contacts count - MULTI-TENANT
        const { data: campaigns, error: campaignError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('organization_id', organizationId)

        if (campaignError) throw campaignError

        const campaignsList = campaigns || []

        // For each campaign, get metrics - MULTI-TENANT
        const campaignMetrics = await Promise.all(
            campaignsList.map(async (campaign) => {
                // Count contacts from this campaign
                const { count: contactCount } = await supabase
                    .from('contacts')
                    .select('*', { count: 'exact', head: true })
                    .eq('campaign_id', campaign.id)
                    .eq('organization_id', organizationId)

                // Count converted contacts (with paid invoices)
                const { data: convertedContacts } = await supabase
                    .from('contacts')
                    .select(`
                        id,
                        invoices!inner(id, status)
                    `)
                    .eq('campaign_id', campaign.id)
                    .eq('organization_id', organizationId)
                    .eq('invoices.status', 'paid')

                const conversions = convertedContacts?.length || 0

                // Calculate revenue from this campaign
                const { data: revenue } = await supabase
                    .from('payments')
                    .select('amount')
                    .eq('status', 'completed')
                    .in('contact_id',
                        await supabase
                            .from('contacts')
                            .select('id')
                            .eq('campaign_id', campaign.id)
                            .then(res => res.data?.map(c => c.id) || [])
                    )

                const totalRevenue = revenue?.reduce((sum, p) => sum + Number(p.amount), 0) || 0
                const budget = Number(campaign.budget || 0)
                const roi = budget > 0 ? ((totalRevenue - budget) / budget) * 100 : 0
                const conversionRate = (contactCount || 0) > 0 ? (conversions / (contactCount || 1)) * 100 : 0
                const costPerLead = (contactCount || 0) > 0 ? budget / (contactCount || 1) : 0
                const costPerAcquisition = conversions > 0 ? budget / conversions : 0

                return {
                    id: campaign.id,
                    name: campaign.name,
                    type: campaign.type,
                    status: campaign.status,
                    start_date: campaign.start_date,
                    end_date: campaign.end_date,
                    budget,
                    metrics: {
                        leads_generated: contactCount || 0,
                        conversions,
                        conversion_rate: Number(conversionRate.toFixed(2)),
                        total_revenue: totalRevenue,
                        roi: Number(roi.toFixed(2)),
                        cost_per_lead: Number(costPerLead.toFixed(2)),
                        cost_per_acquisition: Number(costPerAcquisition.toFixed(2))
                    }
                }
            })
        )

        // Calculate aggregate metrics
        const totalBudget = campaignsList.reduce((sum, c) => sum + Number(c.budget || 0), 0)
        const totalLeads = campaignMetrics.reduce((sum, c) => sum + c.metrics.leads_generated, 0)
        const totalConversions = campaignMetrics.reduce((sum, c) => sum + c.metrics.conversions, 0)
        const totalRevenue = campaignMetrics.reduce((sum, c) => sum + c.metrics.total_revenue, 0)
        const overallROI = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget) * 100 : 0
        const overallConversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0

        // Group by status
        const byStatus = {
            active: campaignMetrics.filter(c => c.status === 'active'),
            completed: campaignMetrics.filter(c => c.status === 'completed'),
            paused: campaignMetrics.filter(c => c.status === 'paused')
        }

        // Group by type
        const byType: { [key: string]: any[] } = {}
        campaignMetrics.forEach(c => {
            const type = c.type || 'other'
            if (!byType[type]) byType[type] = []
            byType[type].push(c)
        })

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    total_campaigns: campaignsList.length,
                    active_campaigns: byStatus.active.length,
                    total_budget: totalBudget,
                    total_leads: totalLeads,
                    total_conversions: totalConversions,
                    total_revenue: totalRevenue,
                    overall_roi: Number(overallROI.toFixed(2)),
                    overall_conversion_rate: Number(overallConversionRate.toFixed(2)),
                    avg_cost_per_lead: totalLeads > 0 ? Number((totalBudget / totalLeads).toFixed(2)) : 0,
                    avg_cost_per_acquisition: totalConversions > 0 ? Number((totalBudget / totalConversions).toFixed(2)) : 0
                },
                campaigns: campaignMetrics,
                by_status: {
                    active: byStatus.active.length,
                    completed: byStatus.completed.length,
                    paused: byStatus.paused.length
                },
                by_type: Object.keys(byType).map(type => ({
                    type,
                    count: byType[type].length,
                    leads: byType[type].reduce((sum, c) => sum + c.metrics.leads_generated, 0),
                    conversions: byType[type].reduce((sum, c) => sum + c.metrics.conversions, 0),
                    revenue: byType[type].reduce((sum, c) => sum + c.metrics.total_revenue, 0)
                }))
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: '/api/analytics/campaigns',
            method: 'GET',
            error
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
