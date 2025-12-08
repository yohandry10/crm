import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { createEmailClient } from "@/lib/email-sync"
import crypto from "crypto"
import { z } from "zod"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 50 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }

const sendEmailSchema = z.object({
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, "Asunto requerido"),
  body: z.string().min(1, "Mensaje requerido"),
  bodyHtml: z.string().optional(),
  contactId: z.string().uuid().optional(),
  replyToMessageId: z.string().optional(),
})

// GET: List synced emails or get emails for a contact
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()

    const searchParams = request.nextUrl.searchParams
    const contactId = searchParams.get("contact_id")
    const contactEmail = searchParams.get("contact_email")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")

    // Get user's email account
    const { data: emailAccount } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single()

    if (!emailAccount) {
      return NextResponse.json({
        success: false,
        error: "No hay cuenta de email conectada",
        needsConnection: true
      }, { status: 400 })
    }

    // Check if token is expired and refresh if needed
    if (new Date(emailAccount.expires_at) <= new Date()) {
      // TODO: Implement token refresh
      return NextResponse.json({
        success: false,
        error: "Token expirado, reconecta tu cuenta",
        needsReconnection: true
      }, { status: 401 })
    }

    // If contact email provided, fetch from API
    if (contactEmail) {
      const client = createEmailClient(emailAccount.provider, emailAccount.access_token)
      const emails = await client.getEmailsByContact(contactEmail)

      // Store in local cache - batch upsert to avoid N+1
      if (emails.length > 0) {
        const emailsToUpsert = emails.map((email: any) => ({
          organization_id: organizationId,
          user_id: user.id,
          external_id: email.id,
          thread_id: email.threadId,
          from_email: email.from,
          to_emails: email.to,
          subject: email.subject,
          body_preview: email.body.substring(0, 500),
          received_at: email.date,
          is_read: email.isRead,
          contact_id: contactId,
        }))

        await supabase
          .from("synced_emails")
          .upsert(emailsToUpsert, { onConflict: "external_id" })
      }

      return NextResponse.json({
        success: true,
        data: emails
      })
    }

    // Get from local cache
    let query = supabase
      .from("synced_emails")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    if (contactId) {
      query = query.eq("contact_id", contactId)
    }

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/emails/sync",
      method: "GET",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// POST: Send email
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const body = await request.json()

    const validation = sendEmailSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: "Validation failed",
        details: validation.error.errors
      }, { status: 400 })
    }

    // Get user's email account
    const { data: emailAccount } = await supabase
      .from("email_accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("organization_id", organizationId)
      .single()

    if (!emailAccount) {
      return NextResponse.json({
        success: false,
        error: "No hay cuenta de email conectada"
      }, { status: 400 })
    }

    const client = createEmailClient(emailAccount.provider, emailAccount.access_token)
    const result = await client.sendEmail({
      to: validation.data.to,
      cc: validation.data.cc,
      subject: validation.data.subject,
      body: validation.data.body,
      bodyHtml: validation.data.bodyHtml,
    })

    // Log sent email
    await supabase
      .from("synced_emails")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        external_id: result.id,
        from_email: emailAccount.email,
        to_emails: validation.data.to,
        subject: validation.data.subject,
        body_preview: validation.data.body.substring(0, 500),
        received_at: new Date().toISOString(),
        is_read: true,
        direction: "outbound",
        contact_id: validation.data.contactId,
      })

    return NextResponse.json({
      success: true,
      data: { messageId: result.id }
    })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/emails/sync",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
