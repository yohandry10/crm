import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

export async function GET(_request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const now = new Date()
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

        const [
            { count: contactsThisMonth },
            { data: invoicesThisMonth },
            { count: inventoryThisMonth },
            { count: contactsLastMonth },
            { data: invoicesLastMonth }
        ] = await Promise.all([
            supabase.from("contacts").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).gte("created_at", thisMonthStart.toISOString()),
            supabase.from("invoices").select("total, status")
                .eq("organization_id", organizationId).gte("issue_date", thisMonthStart.toISOString()).in("status", ["paid", "sent"]),
            supabase.from("inventory").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId),
            supabase.from("contacts").select("*", { count: "exact", head: true })
                .eq("organization_id", organizationId).gte("created_at", lastMonthStart.toISOString()).lte("created_at", lastMonthEnd.toISOString()),
            supabase.from("invoices").select("total")
                .eq("organization_id", organizationId).gte("issue_date", lastMonthStart.toISOString()).lte("issue_date", lastMonthEnd.toISOString()).in("status", ["paid", "sent"])
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

        const { data: recentInvoices } = await supabase
            .from("invoices")
            .select("invoice_number, total, status, issue_date")
            .eq("organization_id", organizationId)
            .order("issue_date", { ascending: false })
            .limit(5)

        const response = NextResponse.json({
            success: true,
            data: { stats, recentInvoices: recentInvoices || [] },
            cachedAt: new Date().toISOString()
        })
        response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=0')
        return response
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/dashboard", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
