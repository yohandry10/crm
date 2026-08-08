import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { logAuditEvent } from "@/lib/audit"
import { createRequestLogger } from "@/lib/logger"

export const runtime = "nodejs"

const DEMO_RATE_LIMIT = { interval: 15 * 60 * 1000, maxRequests: 5 }

const demoTenantSchema = z.object({
  countryCode: z.string().trim().min(2).max(2).default("PE"),
  companyName: z.string().trim().min(1).max(120).optional(),
})

function demoPassword() {
  return `Demo-${crypto.randomBytes(9).toString("base64url")}9!a`
}

function demoEmail() {
  const token = crypto.randomBytes(6).toString("hex")
  return `demo+${Date.now()}-${token}@neon-demo.test`
}

function normalizeCountry(countryCode: string) {
  const code = countryCode.trim().toUpperCase()
  return code === "PE" ? "PE" : code.slice(0, 2)
}

async function attachDemoOwner(params: {
  supabaseAdmin: ReturnType<typeof createSupabaseServiceClient>
  organizationId: string
  userId: string
  email: string
  companyName: string
}) {
  const { supabaseAdmin, organizationId, userId, email, companyName } = params
  const now = new Date().toISOString()

  const operations = [
    supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          email,
          full_name: "Usuario Demo",
          company_name: companyName,
          job_title: "Administrador demo",
          current_organization_id: organizationId,
          updated_at: now,
        },
        { onConflict: "id" }
      ),
    supabaseAdmin
      .from("organizations")
      .update({
        created_by: userId,
        email,
        billing_email: email,
        updated_at: now,
      })
      .eq("id", organizationId),
    supabaseAdmin
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          role: "owner",
          is_active: true,
          invited_by: userId,
          accepted_at: now,
          updated_at: now,
        },
        { onConflict: "organization_id,user_id" }
      ),
    supabaseAdmin.from("accounts").update({ created_by: userId }).eq("organization_id", organizationId),
    supabaseAdmin
      .from("contacts")
      .update({ created_by: userId, assigned_to: userId })
      .eq("organization_id", organizationId),
    supabaseAdmin.from("products").update({ created_by: userId }).eq("organization_id", organizationId),
    supabaseAdmin
      .from("opportunities")
      .update({ created_by: userId, assigned_to: userId })
      .eq("organization_id", organizationId),
    supabaseAdmin.from("quotes").update({ created_by: userId }).eq("organization_id", organizationId),
    supabaseAdmin.from("invoices").update({ created_by: userId }).eq("organization_id", organizationId),
    supabaseAdmin.from("payments").update({ created_by: userId }).eq("organization_id", organizationId),
    supabaseAdmin
      .from("tasks")
      .update({ created_by: userId, assigned_to: userId })
      .eq("organization_id", organizationId),
    supabaseAdmin.from("campaigns").update({ created_by: userId }).eq("organization_id", organizationId),
    supabaseAdmin
      .from("web_forms")
      .update({ created_by: userId, assigned_to: userId })
      .eq("organization_id", organizationId),
    supabaseAdmin.from("workflows").update({ created_by: userId }).eq("organization_id", organizationId),
  ]

  const results = await Promise.all(operations)
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error

  const { data: contact } = await supabaseAdmin
    .from("contacts")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: opportunity } = await supabaseAdmin
    .from("opportunities")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const { error: calendarError } = await supabaseAdmin.from("calendar_events").insert({
    organization_id: organizationId,
    owner_id: userId,
    contact_id: contact?.id || null,
    opportunity_id: opportunity?.id || null,
    title: "Reunión demo de cierre",
    description: "Evento demo conectado a contacto y oportunidad.",
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    location: "Google Meet",
    event_type: "meeting",
    status: "scheduled",
    attendees: [{ email: "maria.torres@example.com", name: "María Torres" }],
    reminder_minutes: 30,
  })

  if (calendarError) throw calendarError
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  let createdUserId: string | null = null

  try {
    const rateLimitResponse = await rateLimit(request, DEMO_RATE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const parsed = demoTenantSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos de demo inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const countryCode = normalizeCountry(parsed.data.countryCode)
    const companyName = parsed.data.companyName || `Empresa Demo ${new Date().toISOString().slice(0, 10)}`
    const email = demoEmail()
    const password = demoPassword()
    const supabaseAdmin = createSupabaseServiceClient()

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: "Usuario Demo",
        company_name: companyName,
        demo_user: true,
      },
    })

    if (authError) throw authError
    const user = authData.user
    if (!user?.id) throw new Error("No se pudo crear el usuario demo")
    createdUserId = user.id

    const { data: demoData, error: demoError } = await supabaseAdmin.rpc("create_demo_tenant", {
      p_dias_duracion: 14,
      p_nombre: companyName,
      p_pais_codigo: countryCode,
    })

    if (demoError) throw demoError

    const demo = Array.isArray(demoData) ? demoData[0] : demoData
    const organizationId = demo?.organization_id || demo?.tenant_id
    if (!organizationId) throw new Error("La demo no devolvió organization_id")

    await attachDemoOwner({
      supabaseAdmin,
      organizationId,
      userId: user.id,
      email,
      companyName,
    })

    await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        full_name: "Usuario Demo",
        company_name: companyName,
        demo_user: true,
        organization_id: organizationId,
      },
    })

    await logAuditEvent({
      supabase: supabaseAdmin,
      request,
      userId: user.id,
      organizationId,
      action: "DEMO_TENANT_CREATED",
      category: "auth",
      table: "organizations",
      recordId: organizationId,
      metadata: {
        countryCode,
        seed: demo?.seed || null,
      },
      success: true,
    })

    return NextResponse.json({
      success: true,
      data: {
        organizationId,
        expiresAt: demo?.expires_at || null,
        seed: demo?.seed || null,
        redirectTo: "/dashboard?demo=1",
        credentials: {
          email,
          password,
        },
      },
    })
  } catch (error: any) {
    log.error("POST /api/demo/tenant failed", error)

    if (createdUserId) {
      try {
        const supabaseAdmin = createSupabaseServiceClient()
        await supabaseAdmin.auth.admin.deleteUser(createdUserId)
      } catch (cleanupError) {
        log.error("Demo user cleanup failed", cleanupError)
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "No se pudo crear la demo. Intenta nuevamente.",
        details: process.env.NODE_ENV === "development" ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}
