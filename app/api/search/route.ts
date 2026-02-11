import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()

    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")?.trim()

    if (!query || query.length < 2) {
      return NextResponse.json({ success: true, data: [] })
    }

    const searchPattern = `%${query}%`
    const results: any[] = []

    // Search navigation
    const navigationOptions = [
      { title: "Dashboard", url: "/dashboard", icon: "LayoutDashboard" },
      { title: "Contactos", url: "/contacts", icon: "Users" },
      { title: "Leads", url: "/leads", icon: "Users" },
      { title: "Oportunidades", url: "/pipeline", icon: "DollarSign" },
      { title: "Cotizaciones", url: "/quotes", icon: "FileText" },
      { title: "Facturación", url: "/invoicing", icon: "Receipt" },
      { title: "Productos", url: "/products", icon: "Package" },
      { title: "Campañas", url: "/marketing", icon: "Megaphone" },
      { title: "Tareas", url: "/tasks", icon: "CheckSquare" },
      { title: "Calendario", url: "/calendar", icon: "Calendar" },
      { title: "Inventario", url: "/products?tab=inventory", icon: "Boxes" },
      { title: "Analytics", url: "/analytics", icon: "PieChart" },
      { title: "Reportes", url: "/reports", icon: "BarChart" },
      { title: "Workflows", url: "/workflows", icon: "GitFork" },
      { title: "Integraciones", url: "/integrations", icon: "Link" },
      { title: "Configuración", url: "/settings", icon: "Settings" },
    ]

    const matchedNav = navigationOptions.filter(opt =>
      opt.title.toLowerCase().includes(query.toLowerCase())
    )

    matchedNav.forEach(nav => {
      results.push({
        id: `nav-${nav.title}`,
        type: "navigation",
        title: nav.title,
        subtitle: "Ir a módulo",
        url: nav.url,
      })
    })

    // Search contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, name, email, company")
      .eq("organization_id", organizationId)
      .or(`name.ilike.${searchPattern},email.ilike.${searchPattern},company.ilike.${searchPattern}`)
      .limit(5)

    contacts?.forEach(c => {
      results.push({
        id: c.id,
        type: "contact",
        title: c.name,
        subtitle: c.email || c.company || "",
        url: `/contacts?id=${c.id}`,
      })
    })

    // Search accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, name, industry")
      .eq("organization_id", organizationId)
      .or(`name.ilike.${searchPattern},industry.ilike.${searchPattern}`)
      .limit(5)

    accounts?.forEach(a => {
      results.push({
        id: a.id,
        type: "account",
        title: a.name,
        subtitle: a.industry || "",
        url: `/accounts?id=${a.id}`,
      })
    })

    // Search opportunities
    const { data: opportunities } = await supabase
      .from("opportunities")
      .select("id, name, expected_revenue, stage:pipeline_stages(name)")
      .eq("organization_id", organizationId)
      .ilike("name", searchPattern)
      .limit(5)

    opportunities?.forEach(o => {
      const stageName = (o.stage as any)?.name || "Sin etapa"
      const revenue = Number(o.expected_revenue || 0)
      results.push({
        id: o.id,
        type: "opportunity",
        title: o.name,
        subtitle: `${stageName} - S/ ${revenue.toLocaleString()}`,
        url: `/pipeline?id=${o.id}`,
      })
    })

    // Search invoices
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, invoice_number, total, status, contacts(name)")
      .eq("organization_id", organizationId)
      .or(`invoice_number.ilike.${searchPattern}`)
      .limit(5)

    invoices?.forEach(i => {
      results.push({
        id: i.id,
        type: "invoice",
        title: i.invoice_number || `Factura #${i.id.slice(0, 8)}`,
        subtitle: `${(i.contacts as any)?.name || ""} - S/ ${i.total?.toLocaleString() || 0}`,
        url: `/invoicing/${i.id}`,
      })
    })

    // Search tasks
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority")
      .eq("organization_id", organizationId)
      .ilike("title", searchPattern)
      .limit(5)

    tasks?.forEach(t => {
      results.push({
        id: t.id,
        type: "task",
        title: t.title,
        subtitle: `${t.status} - ${t.priority}`,
        url: `/tasks?id=${t.id}`,
      })
    })

    // Search tickets
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, subject, status, priority")
      .eq("organization_id", organizationId)
      .ilike("subject", searchPattern)
      .limit(5)

    tickets?.forEach(t => {
      results.push({
        id: t.id,
        type: "ticket",
        title: t.subject,
        subtitle: `${t.status} - ${t.priority}`,
        url: `/tickets?id=${t.id}`,
      })
    })

    // Search products
    const { data: products } = await supabase
      .from("products")
      .select("id, name, sku, price")
      .eq("organization_id", organizationId)
      .or(`name.ilike.${searchPattern},sku.ilike.${searchPattern}`)
      .limit(5)

    products?.forEach(p => {
      results.push({
        id: p.id,
        type: "product",
        title: p.name,
        subtitle: `${p.sku || ""} - S/ ${p.price?.toLocaleString() || 0}`,
        url: `/products?id=${p.id}`,
      })
    })

    // Sort by relevance (exact matches first)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1
      const bExact = b.title.toLowerCase().startsWith(query.toLowerCase()) ? 0 : 1
      return aExact - bExact
    })

    return NextResponse.json({
      success: true,
      data: results.slice(0, 15), // Max 15 results
    })
  } catch (error: any) {
    console.error("Search error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
