import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"

function groupPaymentsByWeek(payments: any[]) {
    if (payments.length === 0) {
        return [{ month: "Sem 1", ventas: 0 }, { month: "Sem 2", ventas: 0 }, { month: "Sem 3", ventas: 0 }, { month: "Sem 4", ventas: 0 }]
    }
    const grouped: { [key: string]: number } = {}
    payments.forEach(payment => {
        const date = new Date(payment.paid_at)
        const weekKey = `Sem ${Math.ceil(date.getDate() / 7)}`
        grouped[weekKey] = (grouped[weekKey] || 0) + Number(payment.amount)
    })
    return Object.entries(grouped).map(([month, ventas]) => ({ month, ventas, leads: 0 }))
}

function generatePredictions(totalRevenue: number, avgLeadScore: number) {
    if (totalRevenue === 0) return []
    return [
        { categoria: "Conversión Alta", probabilidad: Math.min(95, 70 + (avgLeadScore / 2)), valor: `S/ ${(totalRevenue * 0.4).toLocaleString()}` },
        { categoria: "Conversión Media", probabilidad: Math.min(80, 60 + (avgLeadScore / 3)), valor: `S/ ${(totalRevenue * 0.3).toLocaleString()}` },
        { categoria: "Nuevos Leads", probabilidad: 65, valor: `S/ ${(totalRevenue * 0.2).toLocaleString()}` }
    ]
}

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const searchParams = request.nextUrl.searchParams
        const period = searchParams.get("period") || "month"

        const now = new Date()
        const startDate = new Date()
        switch (period) {
            case "week": startDate.setDate(now.getDate() - 7); break
            case "month": startDate.setMonth(now.getMonth() - 1); break
            case "quarter": startDate.setMonth(now.getMonth() - 3); break
            case "year": startDate.setFullYear(now.getFullYear() - 1); break
        }

        const { data: contacts, error } = await supabase.from("contacts").select("*").eq("organization_id", organizationId).gte("created_at", startDate.toISOString())
        if (error) throw error
        const contactsList = contacts || []

        const [invoices, payments, opportunities, campaigns] = await Promise.all([
            supabase.from('invoices').select('total, status, issue_date, contact_id').eq('organization_id', organizationId).gte('issue_date', startDate.toISOString().split('T')[0]),
            supabase.from('payments').select('amount, paid_at, status').eq('organization_id', organizationId).eq('status', 'completed').gte('paid_at', startDate.toISOString()),
            supabase.from('opportunities').select('expected_revenue, status, created_at, stage_id').eq('organization_id', organizationId).gte('created_at', startDate.toISOString()),
            supabase.from('campaigns').select('budget, status, type').eq('organization_id', organizationId).eq('status', 'active')
        ])

        if (invoices.error) throw invoices.error
        if (payments.error) throw payments.error
        if (opportunities.error) throw opportunities.error
        if (campaigns.error) throw campaigns.error

        const invoicesList = invoices.data || []
        const paymentsList = payments.data || []
        const opportunitiesList = opportunities.data || []
        const campaignsList = campaigns.data || []

        const totalRevenue = paymentsList.reduce((sum, p) => sum + Number(p.amount), 0)
        const wonOpportunities = opportunitiesList.filter(o => o.status === 'won')
        const openOpportunities = opportunitiesList.filter(o => o.status === 'open')
        const closedOpportunities = opportunitiesList.filter(o => o.status === 'won' || o.status === 'lost')
        const pipelineValue = openOpportunities.reduce((sum, o) => sum + Number(o.expected_revenue), 0)
        const wonValue = wonOpportunities.reduce((sum, o) => sum + Number(o.expected_revenue), 0)
        const winRate = closedOpportunities.length > 0 ? (wonOpportunities.length / closedOpportunities.length) * 100 : 0

        const eligibleLeads = contactsList.filter(c => c.lead_status && c.lead_status !== 'cold')
        const paidContactIds = new Set(invoicesList.filter(i => i.status === 'paid').map(i => i.contact_id).filter(Boolean))
        const conversionRate = eligibleLeads.length > 0 ? (paidContactIds.size / eligibleLeads.length) * 100 : 0
        const avgLeadScore = contactsList.reduce((sum: any, c: any) => sum + (c.lead_score || 0), 0) / (contactsList.length || 1)

        const salesData = groupPaymentsByWeek(paymentsList)
        const predictions = generatePredictions(totalRevenue, avgLeadScore)

        const response = NextResponse.json({
            success: true,
            data: {
                metrics: {
                    new_contacts: contactsList.length, total_revenue: totalRevenue, invoices_generated: invoicesList.length,
                    payments_received: paymentsList.length, avg_lead_score: Number(avgLeadScore.toFixed(2)),
                    conversion_rate: Number(conversionRate.toFixed(2)), pipeline_value: pipelineValue, won_value: wonValue,
                    win_rate: Number(winRate.toFixed(2)), active_campaigns: campaignsList.length,
                    marketing_budget: campaignsList.reduce((sum, c) => sum + Number(c.budget), 0)
                },
                salesData, predictions
            },
            cachedAt: new Date().toISOString()
        })
        // Cache for 5 minutes
        response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')
        return response
    } catch (error: any) {
        console.error("Analytics API Error:", error)
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
