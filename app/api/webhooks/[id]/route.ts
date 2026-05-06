import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { ForbiddenError, sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { decryptSecret, encryptSecret } from "@/lib/encryption"
import { validateOutboundWebhookUrl } from "@/lib/outbound-url-security"
import crypto from "crypto"
import { z } from "zod"

const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }

const WEBHOOK_EVENTS = [
  "contact.created", "contact.updated", "contact.deleted",
  "lead.created", "lead.converted",
  "opportunity.created", "opportunity.updated", "opportunity.won", "opportunity.lost",
  "invoice.created", "invoice.paid", "invoice.overdue",
  "task.created", "task.completed",
  "quote.created", "quote.accepted",
] as const

const updateWebhookSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).optional(),
  is_active: z.boolean().optional(),
  headers: z.record(z.string()).optional(),
  regenerate_secret: z.boolean().optional(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId, role } = await getAuthenticatedContext()

    if (!["owner", "admin"].includes(role)) {
      throw new ForbiddenError("Solo owner/admin pueden ver webhooks")
    }

    const { data, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (error) throw error
    if (!data) {
      return NextResponse.json(
        { success: false, error: "Webhook no encontrado" },
        { status: 404 }
      )
    }

    // Get recent deliveries
    const { data: deliveries } = await supabase
      .from("webhook_deliveries")
      .select("*")
      .eq("webhook_id", id)
      .order("delivered_at", { ascending: false })
      .limit(20)

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        secret: (data.secret || data.secret_encrypted) ? "••••••••" : null,
        secret_encrypted: undefined,
        deliveries
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const { supabase, user, organizationId, role } = await getAuthenticatedContext()

    if (!["owner", "admin"].includes(role)) {
      throw new ForbiddenError("Solo owner/admin pueden gestionar webhooks")
    }

    const body = await request.json()

    const validation = updateWebhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    if (validation.data.url) {
      const urlValidation = await validateOutboundWebhookUrl(validation.data.url)
      if (!urlValidation.valid) {
        return NextResponse.json({
          success: false,
          error: `URL de webhook inválida: ${urlValidation.error}`
        }, { status: 400 })
      }
    }

    // Get existing
    const { data: existing } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Webhook no encontrado" },
        { status: 404 }
      )
    }

    const updateData: any = {}
    let regeneratedSecret: string | null = null
    if (validation.data.name) updateData.name = validation.data.name
    if (validation.data.url) updateData.url = validation.data.url
    if (validation.data.events) updateData.events = validation.data.events
    if (validation.data.is_active !== undefined) updateData.is_active = validation.data.is_active
    if (validation.data.headers) updateData.headers = validation.data.headers
    if (validation.data.regenerate_secret) {
      const newSecret = crypto.randomBytes(32).toString("hex")
      regeneratedSecret = newSecret
      updateData.secret = null
      updateData.secret_encrypted = encryptSecret(newSecret)
    }

    const { data, error } = await supabase
      .from("webhooks")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single()

    if (error) throw error

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "UPDATE_WEBHOOK",
      table: "webhooks",
      recordId: id,
      oldData: { ...existing, secret: "***", secret_encrypted: "***" },
      newData: { ...data, secret: "***", secret_encrypted: "***" },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...data,
        secret: validation.data.regenerate_secret ? regeneratedSecret : "••••••••",
        secret_encrypted: undefined
      }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: `/api/webhooks/${(await params).id}`,
      method: "PUT",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const { supabase, user, organizationId, role } = await getAuthenticatedContext()

    if (!["owner", "admin"].includes(role)) {
      throw new ForbiddenError("Solo owner/admin pueden gestionar webhooks")
    }

    const { data: existing } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Webhook no encontrado" },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from("webhooks")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (error) throw error

    await logAudit({
      supabase,
      request,
      userId: user.id,
      organizationId,
      action: "DELETE_WEBHOOK",
      table: "webhooks",
      recordId: id,
      oldData: { ...existing, secret: "***", secret_encrypted: "***" },
    })

    return NextResponse.json({ success: true })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: `/api/webhooks/${(await params).id}`,
      method: "DELETE",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// POST: Test webhook
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { id } = await params
    const { supabase, organizationId, role } = await getAuthenticatedContext()

    if (!["owner", "admin"].includes(role)) {
      throw new ForbiddenError("Solo owner/admin pueden probar webhooks")
    }

    const { data: webhook } = await supabase
      .from("webhooks")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (!webhook) {
      return NextResponse.json(
        { success: false, error: "Webhook no encontrado" },
        { status: 404 }
      )
    }

    // Send test payload
    const testPayload = {
      event: "test",
      timestamp: Date.now(),
      data: {
        message: "Este es un webhook de prueba",
        webhook_id: id,
      }
    }

    const body = JSON.stringify(testPayload)

    let webhookSecret: string | null = webhook.secret ?? null
    if (!webhookSecret && webhook.secret_encrypted) {
      try {
        webhookSecret = decryptSecret(webhook.secret_encrypted)
      } catch {
        webhookSecret = null
      }
    }

    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Webhook secret no configurado" },
        { status: 400 }
      )
    }

    const signature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex")

    const urlValidation = await validateOutboundWebhookUrl(webhook.url)
    if (!urlValidation.valid) {
      return NextResponse.json(
        { success: false, error: `URL de webhook inválida: ${urlValidation.error}` },
        { status: 400 }
      )
    }

    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "test",
        "X-Webhook-Timestamp": testPayload.timestamp.toString(),
        ...webhook.headers,
      },
      body,
    })

    const responseBody = await response.text().catch(() => null)

    // Log test delivery
    await supabase
      .from("webhook_deliveries")
      .insert({
        webhook_id: id,
        event: "test",
        payload: testPayload.data,
        response_status: response.status,
        response_body: responseBody,
        delivered_at: new Date().toISOString(),
        success: response.ok,
      })

    return NextResponse.json({
      success: response.ok,
      data: {
        status: response.status,
        response: responseBody,
      }
    })

  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
