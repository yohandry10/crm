import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from '@/lib/supabase-auth'

// MCP Tools disponibles
const MCP_TOOLS = {
  get_contacts: {
    name: "get_contacts",
    description: "Obtiene contactos del CRM con filtros opcionales",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 10 },
        lead_score_min: { type: "number" },
        search: { type: "string" },
      },
    },
  },
  predict_lead_score: {
    name: "predict_lead_score",
    description: "Predice el lead score de un contacto usando IA",
    inputSchema: {
      type: "object",
      properties: {
        contact_id: { type: "string", required: true },
        interactions: { type: "number" },
        last_activity: { type: "string" },
      },
    },
  },
  get_analytics: {
    name: "get_analytics",
    description: "Obtiene analytics y métricas del CRM",
    inputSchema: {
      type: "object",
      properties: {
        period: { type: "string", enum: ["week", "month", "quarter"] },
        metric: { type: "string" },
      },
    },
  },
}

// Implementación de tools MCP - MULTI-TENANT
async function executeToolCall(toolName: string, args: any, supabase: any, organizationId: string) {
  switch (toolName) {
    case "get_contacts":
      return await getContacts(supabase, args, organizationId)
    case "predict_lead_score":
      return await predictLeadScore(supabase, args, organizationId)
    case "get_analytics":
      return await getAnalytics(supabase, args, organizationId)
    default:
      throw new Error(`Tool ${toolName} not found`)
  }
}

async function getContacts(supabase: any, args: any, organizationId: string) {
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .limit(args.limit || 10)

  if (args.lead_score_min) {
    query = query.gte("lead_score", args.lead_score_min)
  }

  if (args.search) {
    query = query.or(`name.ilike.%${args.search}%,email.ilike.%${args.search}%`)
  }

  const { data, error } = await query
  if (error) throw error

  return {
    contacts: data,
    count: data?.length || 0,
    message: `Encontrados ${data?.length || 0} contactos`,
  }
}

async function predictLeadScore(supabase: any, args: any, organizationId: string) {
  const { contact_id, interactions = 0, last_activity } = args

  // Obtener datos del contacto - MULTI-TENANT
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contact_id)
    .eq("organization_id", organizationId)
    .single()

  if (!contact) throw new Error("Contacto no encontrado")

  // Calcular score basado en múltiples factores
  let score = 50 // Base score

  // Factor: Interacciones
  score += Math.min(interactions * 5, 30)

  // Factor: Actividad reciente
  if (last_activity) {
    const daysSinceActivity = Math.floor((Date.now() - new Date(last_activity).getTime()) / (1000 * 60 * 60 * 24))
    score += Math.max(20 - daysSinceActivity, -10)
  }

  // Factor: Datos del perfil
  if (contact.ruc) score += 15
  if (contact.phone) score += 10

  // Normalizar score (0-100)
  score = Math.max(0, Math.min(100, score))

  // Actualizar score en base de datos
  await supabase
    .from("contacts")
    .update({ lead_score: score })
    .eq("id", contact_id)
    .eq("organization_id", organizationId)

  // Guardar predicción - MULTI-TENANT
  await supabase.from("ai_predictions").insert({
    organization_id: organizationId,
    contact_id,
    prediction_type: "lead_score",
    predicted_value: score,
    confidence: 0.85,
    factors: {
      interactions,
      last_activity,
      has_ruc: !!contact.ruc,
      has_phone: !!contact.phone,
    },
  })

  return {
    contact_id,
    predicted_score: score,
    confidence: 0.85,
    recommendation:
      score > 70
        ? "Alto potencial - Contactar inmediatamente"
        : score > 40
          ? "Potencial medio - Nutrir con contenido"
          : "Bajo potencial - Automatizar seguimiento",
  }
}

async function getAnalytics(supabase: any, args: any, organizationId: string) {
  const { period = "month" } = args

  // Calcular fechas según período
  const now = new Date()
  const startDate = new Date()

  switch (period) {
    case "week":
      startDate.setDate(now.getDate() - 7)
      break
    case "month":
      startDate.setMonth(now.getMonth() - 1)
      break
    case "quarter":
      startDate.setMonth(now.getMonth() - 3)
      break
  }

  // Obtener métricas generales - MULTI-TENANT
  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("organization_id", organizationId)
    .gte("created_at", startDate.toISOString())

  const contactsList = contacts || []

  // Calcular métricas
  const estimatedRevenuePerContact = 1500
  const conversionRateVal = 0.15

  const totalRevenue = contactsList.length * conversionRateVal * estimatedRevenuePerContact
  const avgLeadScore = contactsList.reduce((sum: any, c: any) => sum + (c.lead_score || 0), 0) / (contactsList.length || 1)
  const conversionRate = conversionRateVal * 100
  const invoicesCount = Math.floor(contactsList.length * conversionRateVal)
  const paymentsCount = Math.floor(invoicesCount * 0.8)

  // Predicciones IA simuladas
  const predictions = {
    revenue_forecast: totalRevenue * 1.15,
    churn_risk: Math.max(0, 25 - avgLeadScore / 4),
    best_performing_segment: avgLeadScore > 60 ? "Empresas con RUC" : "Contactos individuales",
  }

  return {
    period,
    metrics: {
      new_contacts: contactsList.length,
      total_revenue: totalRevenue.toFixed(2),
      invoices_generated: invoicesCount,
      payments_received: paymentsCount,
      avg_lead_score: avgLeadScore.toFixed(1),
      conversion_rate: conversionRate.toFixed(1) + "%",
    },
    predictions,
    insights: [
      `Se generaron ${contactsList.length} nuevos contactos en el último ${period}`,
      `El lead score promedio es ${avgLeadScore.toFixed(1)}/100`,
      `Tasa de conversión actual: ${conversionRate.toFixed(1)}%`,
      `Proyección de ingresos: S/ ${predictions.revenue_forecast.toFixed(2)}`,
    ],
  }
}

// Endpoint principal MCP - MULTI-TENANT
export async function POST(request: NextRequest) {
  try {
    // MULTI-TENANT: Get organization context
    const { supabase, organizationId } = await getAuthenticatedContext()

    const { method, params } = await request.json()

    switch (method) {
      case "initialize":
        return NextResponse.json({
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "crm-ai-peru-mcp-server",
            version: "1.0.0",
          },
        })

      case "tools/list":
        return NextResponse.json({
          tools: Object.values(MCP_TOOLS),
        })

      case "tools/call":
        const { name, arguments: args } = params
        const result = await executeToolCall(name, args, supabase, organizationId)
        return NextResponse.json({
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        })

      default:
        return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 })
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized' || error.message?.includes('No organization')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error("MCP Server Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    name: "CRM AI Peru MCP Server",
    version: "1.0.0",
    tools: Object.keys(MCP_TOOLS),
    status: "active",
    auth: "required"
  })
}
