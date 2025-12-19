import { type NextRequest, NextResponse } from "next/server"
import { createRequestLogger } from "@/lib/logger"

// Cliente MCP para conectar con LLMs
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const { message, context = {} } = await request.json()

    // Simular conexión con Claude/Grok via MCP
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin
    const mcpResponse = await callMCPServer(baseUrl, message, context)

    // Generar respuesta IA
    const aiResponse = await generateAIResponse(message, mcpResponse)

    return NextResponse.json({
      response: aiResponse,
      context: mcpResponse,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    log.error("AI Chat Error", error)
    return NextResponse.json({ error: "Error procesando consulta IA" }, { status: 500 })
  }
}

async function callMCPServer(baseUrl: string, message: string, context: any) {
  // Determinar qué tool MCP usar basado en el mensaje
  const toolName = determineToolFromMessage(message)
  const args = extractArgsFromMessage(message, context)

  // Llamar al servidor MCP
  const response = await fetch(`${baseUrl}/api/mcp/server`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  })

  return await response.json()
}

function determineToolFromMessage(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("contacto") || lowerMessage.includes("lead")) {
    if (lowerMessage.includes("score") || lowerMessage.includes("predic")) {
      return "predict_lead_score"
    }
    return "get_contacts"
  }

  if (lowerMessage.includes("factura") || lowerMessage.includes("invoice")) {
    return "generate_invoice"
  }

  if (lowerMessage.includes("analytic") || lowerMessage.includes("métrica") || lowerMessage.includes("reporte")) {
    return "get_analytics"
  }

  return "get_contacts" // Default
}

function extractArgsFromMessage(message: string, context: any): any {
  const lowerMessage = message.toLowerCase()
  const args: any = {}

  // Extraer números para límites o scores
  const numbers = message.match(/\d+/g)
  if (numbers) {
    if (lowerMessage.includes("score") && lowerMessage.includes("mayor")) {
      args.lead_score_min = Number.parseInt(numbers[0])
    }
    if (lowerMessage.includes("límite") || lowerMessage.includes("limit")) {
      args.limit = Number.parseInt(numbers[0])
    }
  }

  // Extraer términos de búsqueda
  const searchMatch = message.match(/buscar?\s+["']?([^"']+)["']?/i)
  if (searchMatch) {
    args.search = searchMatch[1]
  }

  // Usar contexto si está disponible
  if (context.contact_id) {
    args.contact_id = context.contact_id
  }

  return args
}

async function generateAIResponse(message: string, mcpData: any): Promise<string> {
  // Simular respuesta de IA basada en datos MCP
  const content = mcpData.content?.[0]?.text

  if (!content) {
    return "No pude obtener información del CRM. ¿Podrías ser más específico?"
  }

  try {
    const data = JSON.parse(content)

    // Generar respuesta contextual
    if (data.contacts) {
      return `Encontré ${data.count} contactos. ${data.contacts
        .map((c: any) => `• ${c.name} (${c.email}) - Score: ${c.lead_score || "N/A"}`)
        .join("\n")}`
    }

    if (data.predicted_score) {
      return `El lead score predicho es ${data.predicted_score}/100 con ${(data.confidence * 100).toFixed(0)}% de confianza. 
      
Recomendación: ${data.recommendation}`
    }

    if (data.metrics) {
      return `📊 Analytics del último ${data.period}:

• Nuevos contactos: ${data.metrics.new_contacts}
• Ingresos totales: S/ ${data.metrics.total_revenue}
• Lead score promedio: ${data.metrics.avg_lead_score}
• Tasa de conversión: ${data.metrics.conversion_rate}

🔮 Predicciones:
• Proyección de ingresos: S/ ${data.predictions.revenue_forecast.toFixed(2)}
• Riesgo de churn: ${data.predictions.churn_risk.toFixed(1)}%`
    }

    return `Procesé tu consulta: ${JSON.stringify(data, null, 2)}`
  } catch (error) {
    return `Obtuve información del CRM: ${content}`
  }
}
