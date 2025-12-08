import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { sendWhatsAppMessage, generateWhatsAppLink, QUICK_MESSAGES } from "@/lib/whatsapp"
import crypto from "crypto"
import { z } from "zod"

const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

const sendMessageSchema = z.object({
  to: z.string().min(9, "Número de teléfono requerido"),
  type: z.enum(["text", "template"]).default("text"),
  content: z.string().min(1, "Mensaje requerido"),
  templateName: z.string().optional(),
  templateParams: z.array(z.string()).optional(),
  contactId: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const body = await request.json()

    const validation = sendMessageSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    const { to, type, content, templateName, templateParams, contactId } = validation.data

    // Send via WhatsApp API
    const result = await sendWhatsAppMessage({
      to,
      type,
      content: type === "template" && templateName ? {
        name: templateName,
        language: "es",
        components: templateParams ? [{
          type: "body",
          parameters: templateParams.map(text => ({ type: "text", text }))
        }] : undefined
      } : content
    })

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || "Error al enviar mensaje"
      }, { status: 400 })
    }

    // Log message in database
    const { data: messageLog } = await supabase
      .from("whatsapp_messages")
      .insert({
        organization_id: organizationId,
        contact_id: contactId,
        phone_number: to,
        direction: "outbound",
        message_type: type,
        content: typeof content === "string" ? content : JSON.stringify(content),
        whatsapp_message_id: result.messageId,
        status: "sent",
        sent_by: user.id,
      })
      .select()
      .single()

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "SEND_WHATSAPP",
      table: "whatsapp_messages",
      recordId: messageLog?.id,
      newData: { to, type, content },
    })

    return NextResponse.json({
      success: true,
      data: {
        messageId: result.messageId,
        logId: messageLog?.id
      }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/whatsapp/send",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// GET: Generate WhatsApp link (no API needed)
export async function GET(request: NextRequest) {
  try {
    await getAuthenticatedContext()
    
    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get("phone")
    const message = searchParams.get("message")
    const quickMessage = searchParams.get("quick") as keyof typeof QUICK_MESSAGES | null
    const name = searchParams.get("name") || ""

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: "Phone number required"
      }, { status: 400 })
    }

    let finalMessage = message
    if (quickMessage && QUICK_MESSAGES[quickMessage]) {
      // Solo usar mensajes que requieren solo el nombre
      const simpleMessages = ['greeting', 'followup', 'thank_you'] as const
      if (simpleMessages.includes(quickMessage as any)) {
        finalMessage = (QUICK_MESSAGES[quickMessage] as (name: string) => string)(name)
      }
    }

    const link = generateWhatsAppLink(phone, finalMessage || undefined)

    return NextResponse.json({
      success: true,
      data: { link }
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
