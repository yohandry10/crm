import { NextRequest, NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth-helpers"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"
import { z } from "zod"

const settingsSchema = z.object({
  defaultTrialDays: z.number().int().min(1).max(30),
  allowSelfSignup: z.boolean(),
  requireEmailVerification: z.boolean(),
  maintenanceMode: z.boolean(),
  stripeEnabled: z.boolean(),
  mercadoPagoEnabled: z.boolean(),
})

function mapDbToUi(row: any) {
  return {
    defaultTrialDays: row.default_trial_days ?? 2,
    allowSelfSignup: !!row.allow_self_signup,
    requireEmailVerification: row.require_email_verification ?? true,
    maintenanceMode: !!row.maintenance_mode,
    stripeEnabled: !!row.stripe_enabled,
    mercadoPagoEnabled: !!row.mercadopago_enabled,
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase } = await requirePlatformAdmin()

    // Ensure row exists and return it.
    const { data, error } = await supabase
      .from("platform_settings")
      .upsert({ id: 1 }, { onConflict: "id" })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: mapDbToUi(data) })
  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/admin/settings",
      method: "GET",
      error,
    })

    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase } = await requirePlatformAdmin()
    const body = await request.json()

    const validation = settingsSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      )
    }

    const payload = {
      id: 1,
      default_trial_days: validation.data.defaultTrialDays,
      allow_self_signup: validation.data.allowSelfSignup,
      require_email_verification: validation.data.requireEmailVerification,
      maintenance_mode: validation.data.maintenanceMode,
      stripe_enabled: validation.data.stripeEnabled,
      mercadopago_enabled: validation.data.mercadoPagoEnabled,
    }

    const { data, error } = await supabase
      .from("platform_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: mapDbToUi(data) })
  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/admin/settings",
      method: "POST",
      error,
    })

    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

