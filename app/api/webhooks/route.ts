import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { WEBHOOK_EVENTS } from "@/lib/webhooks"
import { encryptSecret } from "@/lib/encryption"
import { validateOutboundWebhookUrl } from "@/lib/outbound-url-security"
import crypto from "crypto"
import { z } from "zod"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 100 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }

const webhookSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  url: z.string().url("URL inválida"),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1, "Selecciona al menos un evento"),
  secret: z.string().optional(),
  is_active: z.boolean().default(true),
  headers: z.record(z.string()).optional(),
})

// GET: List webhooks
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()

    const { data, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw error

    // Mask secrets
    const maskedData = data.map(webhook => ({
      ...webhook,
      secret: (webhook.secret || webhook.secret_encrypted) ? "••••••••" : null,
      secret_encrypted: undefined
    }))

    return NextResponse.json({
      success: true,
      data: maskedData,
      availableEvents: WEBHOOK_EVENTS
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/webhooks",
      method: "GET",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// POST: Create webhook
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const body = await request.json()

    const validation = webhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    const urlValidation = await validateOutboundWebhookUrl(validation.data.url)
    if (!urlValidation.valid) {
      return NextResponse.json({
        success: false,
        error: `URL de webhook inválida: ${urlValidation.error}`
      }, { status: 400 })
    }

    // Generate secret if not provided
    const secret = validation.data.secret || crypto.randomBytes(32).toString("hex")
    const secretEncrypted = encryptSecret(secret)

    const { data, error } = await supabase
      .from("webhooks")
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        name: validation.data.name,
        url: validation.data.url,
        events: validation.data.events,
        secret: null,
        secret_encrypted: secretEncrypted,
        is_active: validation.data.is_active,
        headers: validation.data.headers,
      })
      .select()
      .single()

    if (error) throw error

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "CREATE_WEBHOOK",
      table: "webhooks",
      recordId: data.id,
      newData: { ...validation.data, secret: "***" },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        secret, // Return secret only on creation
        secret_encrypted: undefined
      }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/webhooks",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// sendWebhook function moved to @/lib/webhooks
