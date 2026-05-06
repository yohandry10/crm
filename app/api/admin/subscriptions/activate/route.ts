import { NextRequest, NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth-helpers"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { createRequestLogger } from "@/lib/logger"
import { z } from "zod"

const activationSchema = z.object({
  organizationId: z.string().uuid("Organization ID inválido"),
  plan: z.enum(["starter", "professional", "enterprise"]),
  billingPeriod: z.enum(["monthly", "yearly"]),
  paymentReference: z.string().trim().max(120).optional().nullable(),
})

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const { user } = await requirePlatformAdmin()
    const parsed = activationSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos inválidos", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { organizationId, plan, billingPeriod, paymentReference } = parsed.data

    // Use service role for activating subscription
    const supabaseAdmin = createSupabaseServiceClient()

    const { data, error } = await supabaseAdmin.rpc("activate_subscription", {
      p_organization_id: organizationId,
      p_plan: plan,
      p_billing_period: billingPeriod,
      p_payment_reference: paymentReference || null,
      p_activated_by: user.id,
    })

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    log.error("Error activating subscription", error)
    const status = error.message === "Unauthorized" ? 401 : 
                   error.message.includes("Forbidden") ? 403 : 500
    return NextResponse.json({ success: false, error: error.message }, { status })
  }
}
