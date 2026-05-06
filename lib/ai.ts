/**
 * AI Integration Module
 * Conecta con Gemini para respuestas inteligentes del chatbot.
 */

import { logger } from "./logger"

export interface AIMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

export interface AIResponse {
    success: boolean
    response?: string
    error?: string
    usage?: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}

const SYSTEM_PROMPT = `Eres un asistente de CRM inteligente para empresas peruanas. Tu nombre es "CRM AI Perú".

Tienes acceso a información del CRM del usuario incluyendo:
- Contactos y leads con sus scores
- Facturas y pagos
- Oportunidades de venta
- Tareas pendientes
- Métricas de analytics

Responde siempre en español, de forma concisa y profesional.
Usa emojis moderadamente para hacer las respuestas más amigables.
Si no tienes datos específicos, indica que el usuario debe consultar la sección correspondiente del CRM.

Formato de respuestas:
- Usa markdown para estructurar (negritas, listas)
- Incluye números y métricas cuando sea relevante
- Sugiere acciones concretas cuando sea apropiado`

export async function generateAIResponse(
    userMessage: string,
    context?: {
        contacts?: any[]
        invoices?: any[]
        tasks?: any[]
        metrics?: any
    }
): Promise<AIResponse> {
    const provider = process.env.AI_PROVIDER?.trim().toLowerCase() || "fallback"
    const apiKey = process.env.GEMINI_API_KEY

    if (provider === "disabled" || provider === "local" || provider === "fallback" || !apiKey) {
        return generateFallbackResponse(userMessage, context)
    }

    if (provider !== "gemini") {
        logger.warn("Unsupported AI provider configured, using fallback", { provider })
        return generateFallbackResponse(userMessage, context)
    }

    try {
        const contents: Array<{ role: "user"; parts: Array<{ text: string }> }> = []

        if (context) {
            let contextMessage = 'Contexto actual del CRM:\n'
            
            if (context.contacts?.length) {
                contextMessage += `\nContactos recientes: ${context.contacts.slice(0, 5).map(c => 
                    `${c.name} (Score: ${c.lead_score || 0})`
                ).join(', ')}`
            }
            
            if (context.invoices?.length) {
                const pending = context.invoices.filter(i => i.status !== 'paid')
                contextMessage += `\nFacturas pendientes: ${pending.length}`
            }
            
            if (context.tasks?.length) {
                const pendingTasks = context.tasks.filter(t => t.status === 'pending')
                contextMessage += `\nTareas pendientes: ${pendingTasks.length}`
            }
            
            if (context.metrics) {
                contextMessage += `\nMétricas: Ingresos ${context.metrics.total_revenue || 0}, Contactos ${context.metrics.total_contacts || 0}`
            }

            contents.push({ role: "user", parts: [{ text: contextMessage }] })
        }

        contents.push({ role: "user", parts: [{ text: userMessage }] })

        const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash"
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
                systemInstruction: {
                    parts: [{ text: SYSTEM_PROMPT }],
                },
                contents,
                generationConfig: {
                    maxOutputTokens: 500,
                    temperature: 0.7,
                },
            })
        })

        if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error?.message || 'Gemini API error')
        }

        const data = await response.json()
        const responseText = data.candidates?.[0]?.content?.parts
            ?.map((part: { text?: string }) => part.text || "")
            .join("")
            .trim()

        return {
            success: true,
            response: responseText || 'No pude generar una respuesta.',
            usage: data.usageMetadata
                ? {
                    prompt_tokens: data.usageMetadata.promptTokenCount || 0,
                    completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
                    total_tokens: data.usageMetadata.totalTokenCount || 0,
                }
                : undefined,
        }
    } catch (error: any) {
        logger.error("Gemini API error", error)
        return generateFallbackResponse(userMessage, context)
    }
}

/**
 * Respuesta de fallback cuando no hay API key o falla Gemini
 * Genera respuestas basadas en el contexto real del usuario
 */
function generateFallbackResponse(
    userMessage: string,
    context?: any
): AIResponse {
    const message = userMessage.toLowerCase()
    let response = ''

    if (message.includes('lead') && message.includes('score')) {
        if (context?.contacts?.length) {
            const topLeads = context.contacts
                .filter((c: any) => c.lead_score > 50)
                .sort((a: any, b: any) => b.lead_score - a.lead_score)
                .slice(0, 5)
            
            if (topLeads.length > 0) {
                response = `📊 **Tus leads con mayor score:**\n\n`
                topLeads.forEach((lead: any, i: number) => {
                    response += `${i + 1}. **${lead.name}** - Score: ${lead.lead_score}${lead.lead_score > 80 ? ' ⭐' : ''}\n`
                })
                response += `\n💡 **Recomendación:** Prioriza contactar a los leads con score mayor a 80.`
            } else {
                response = `📊 No tienes leads con score alto actualmente. Considera agregar más contactos o actualizar los scores existentes.`
            }
        } else {
            response = `📊 Para ver tus leads con mayor score, ve a la sección **Contactos** y ordena por score.`
        }
    } else if (message.includes('factura') && message.includes('pendiente')) {
        if (context?.invoices?.length) {
            const pending = context.invoices.filter((i: any) => i.status !== 'paid')
            if (pending.length > 0) {
                const total = pending.reduce((sum: number, i: any) => sum + (i.total || 0), 0)
                response = `📄 **Facturas pendientes:** ${pending.length}\n💰 **Total por cobrar:** S/ ${total.toLocaleString()}\n\nVe a **Facturación** para ver el detalle.`
            } else {
                response = `✅ ¡Excelente! No tienes facturas pendientes de cobro.`
            }
        } else {
            response = `📄 Consulta tus facturas pendientes en la sección **Facturación**.`
        }
    } else if (message.includes('tarea') || message.includes('pendiente')) {
        if (context?.tasks?.length) {
            const pending = context.tasks.filter((t: any) => t.status === 'pending')
            response = `✅ **Tareas pendientes:** ${pending.length}\n\nVe a **Tareas** para ver el detalle y marcarlas como completadas.`
        } else {
            response = `✅ Consulta tus tareas en la sección **Tareas**.`
        }
    } else if (message.includes('venta') || message.includes('ingreso')) {
        if (context?.metrics) {
            response = `💰 **Resumen de ventas:**\n\n`
            response += `• Ingresos totales: S/ ${(context.metrics.total_revenue || 0).toLocaleString()}\n`
            response += `• Contactos: ${context.metrics.total_contacts || 0}\n`
            response += `\nVe a **Analytics** para más detalles.`
        } else {
            response = `💰 Consulta tus métricas de ventas en la sección **Analytics**.`
        }
    } else {
        response = `🤖 Puedo ayudarte con:\n\n`
        response += `• **"¿Cuáles son mis leads con mayor score?"**\n`
        response += `• **"¿Cuántas facturas tengo pendientes?"**\n`
        response += `• **"¿Cuáles son mis tareas pendientes?"**\n`
        response += `• **"Muéstrame el resumen de ventas"**\n\n`
        response += `¿Sobre qué te gustaría saber?`
    }

    return {
        success: true,
        response
    }
}
