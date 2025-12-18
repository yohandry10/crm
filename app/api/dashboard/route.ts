import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { formatDateOnlyInTimezone, getLastNDaysRangeInTimezone, getMonthRangeInTimezone, getOrganizationTimezone } from "@/lib/date-utils"
import crypto from "crypto"

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const now = new Date()
        const timezone = await getOrganizationTimezone(supabase, organizationId)
        const thisMonth = getMonthRangeInTimezone(timezone, now, 0)
        const lastMonth = getMonthRangeInTimezone(timezone, now, -1)
        const last30Days = getLastNDaysRangeInTimezone(timezone, now, 30)

        const [
            { count: contactsThisMonth },
            { data: invoicesThisMonth },
            { count: inventoryThisMonth },
            { count: contactsLastMonth },
            { data: invoicesLastMonth },
            { data: opportunities },
            { data: leadsData },
            { data: stages }
        ] = await Promise.all([
            supabase.from("contacts").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).gte("created_at", thisMonth.startUtc.toISOString()),
            supabase.from("invoices").select("total, status")
                .eq("organization_id", organizationId).gte("issue_date", thisMonth.startDate).in("status", ["paid", "sent"]),
            supabase.from("products").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId)
                .eq("is_service", false),
            supabase.from("contacts").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).gte("created_at", lastMonth.startUtc.toISOString()).lte("created_at", lastMonth.endUtc.toISOString()),
            supabase.from("invoices").select("total")
                .eq("organization_id", organizationId).gte("issue_date", lastMonth.startDate).lte("issue_date", lastMonth.endDate).in("status", ["paid", "sent"]),
            // Fetch opportunities for Pipeline & Activity
            supabase.from("opportunities")
                .select("id, created_at, expected_revenue, stage_id")
                .eq("organization_id", organizationId),
            // Fetch leads for Activity
            supabase.from("contacts")
                .select("id, created_at")
                .eq("organization_id", organizationId)
                .not("lead_status", "is", null)
                .gte("created_at", last30Days.startUtc.toISOString()), // Last 30 days (org timezone)
            supabase.from("pipeline_stages")
                .select("id, name, position")
                .eq("organization_id", organizationId)
                .order("position")
        ])

        const totalSalesThisMonth = invoicesThisMonth?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0
        const totalSalesLastMonth = invoicesLastMonth?.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0) || 0

        const contactsChange = contactsLastMonth && contactsLastMonth > 0
            ? ((((contactsThisMonth || 0) - contactsLastMonth) / contactsLastMonth) * 100) : 0
        const salesChange = totalSalesLastMonth && totalSalesLastMonth > 0
            ? (((totalSalesThisMonth - totalSalesLastMonth) / totalSalesLastMonth) * 100) : 0

        const stats = [
            { title: "Contactos Totales", value: (contactsThisMonth || 0).toString(), change: `${contactsChange >= 0 ? '+' : ''}${contactsChange.toFixed(1)}%`, changeType: contactsChange >= 0 ? "positive" : "negative", icon: "Users" },
            { title: "Ventas del Mes", value: `S/ ${totalSalesThisMonth.toLocaleString('es-PE', { minimumFractionDigits: 2 })}`, change: `${salesChange >= 0 ? '+' : ''}${salesChange.toFixed(1)}%`, changeType: salesChange >= 0 ? "positive" : "negative", icon: "DollarSign" },
            { title: "Inventario Total", value: (inventoryThisMonth || 0).toString(), change: "Items", changeType: "neutral", icon: "Package" },
            { title: "Facturas Generadas", value: (invoicesThisMonth?.length || 0).toString(), change: `${invoicesThisMonth?.length || 0} este mes`, changeType: "positive", icon: "FileText" }
        ]

        // --- Process Activity Overview (Last 30 days) ---
        const activityMap = new Map<string, { leads: number, deals: number }>()
        const thirtyDaysAgo = last30Days.startUtc

        // Init last 30 days with 0
        for (let i = 0; i <= 30; i++) {
            const d = new Date(thirtyDaysAgo)
            d.setUTCDate(d.getUTCDate() + i)
            const dateStr = formatDateOnlyInTimezone(d, timezone)
            activityMap.set(dateStr, { leads: 0, deals: 0 })
        }

        // Aggregate Leads
        leadsData?.forEach((lead: any) => {
            const dateStr = formatDateOnlyInTimezone(new Date(lead.created_at), timezone)
            if (activityMap.has(dateStr)) {
                const entry = activityMap.get(dateStr)!
                entry.leads++
            }
        })

        // Aggregate Deals (Opportunities) - Filter for Last 30 days
        opportunities?.forEach((opp: any) => {
            const dateStr = formatDateOnlyInTimezone(new Date(opp.created_at), timezone)
            if (activityMap.has(dateStr)) {
                const entry = activityMap.get(dateStr)!
                entry.deals++
            }
        })

        const activityOverview = Array.from(activityMap.entries()).map(([date, counts]) => ({
            date,
            leads: counts.leads,
            deals: counts.deals
        })).sort((a, b) => a.date.localeCompare(b.date))

        // --- Process Pipeline ---
        // Group opportunities by stage
        const pipelineMap = new Map<string, { value: number, count: number }>()

        // Init stages
        stages?.forEach((stage: any) => {
            pipelineMap.set(stage.id, { value: 0, count: 0 })
        })

        opportunities?.forEach((opp: any) => {
            if (opp.stage_id && pipelineMap.has(opp.stage_id)) { // Only count if stage exists
                const entry = pipelineMap.get(opp.stage_id)!
                entry.value += Number(opp.expected_revenue || 0)
                entry.count++
            }
        })

        const pipeline = stages?.map((stage: any) => {
            const data = pipelineMap.get(stage.id)!
            return {
                stage: stage.name,
                value: data.value,
                count: data.count
            }
        }) || []


        // --- Recent Invoices (Existing logic) ---
        const { data: recentInvoices } = await supabase
            .from("invoices")
            .select("invoice_number, total, status, issue_date")
            .eq("organization_id", organizationId)
            .order("issue_date", { ascending: false })
            .limit(5)

        const response = NextResponse.json({
            success: true,
            data: { stats, activityOverview, pipeline, recentInvoices: recentInvoices || [] },
            cachedAt: new Date().toISOString()
        })

        // ✅ SECURITY: Prevent cache leaks between organizations
        // Cache más agresivo: 2 min de cache fresco, 5 min stale permitido
        response.headers.set('Cache-Control', 'private, max-age=120, stale-while-revalidate=300')

        // Vary header ensures different cache entries for different auth contexts
        response.headers.set('Vary', 'Authorization, Cookie, X-Organization-ID')

        // Unique cache key per organization to prevent cross-org data leaks
        const cacheKey = crypto.createHash('sha256')
            .update(`dashboard:${organizationId}:${formatDateOnlyInTimezone(now, timezone)}`)
            .digest('hex')
        response.headers.set('X-Cache-Key', cacheKey)

        return response
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/dashboard", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
