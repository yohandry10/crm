import { NextRequest, NextResponse } from "next/server"
import { createAuthenticatedClient } from "@/lib/supabase-auth"
import { createClient } from "@supabase/supabase-js"
import { createRequestLogger } from "@/lib/logger"

async function requirePlatformAdmin() {
  const { supabase } = await createAuthenticatedClient()
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new Error("Unauthorized")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_platform_admin) {
    throw new Error("Forbidden: Platform admin required")
  }

  return { supabase, user }
}

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const { user } = await requirePlatformAdmin()
    const body = await request.json()

    const { organizationId, plan, billingPeriod, paymentReference } = body

    if (!organizationId || !plan || !billingPeriod) {
      return NextResponse.json(
        { success: false, error: "Datos incompletos" },
        { status: 400 }
      )
    }

    // Use service role for activating subscription
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

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
