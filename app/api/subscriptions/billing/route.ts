import { NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"

export async function GET() {
  try {
    const { supabase, organizationId, organization } = await getAuthenticatedContext()

    // Get current plan details
    const { data: currentPlan } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("name", organization.subscription_plan)
      .single()

    // Get invoices from Stripe
    const { data: invoices } = await supabase
      .from("stripe_invoices")
      .select("*")
      .eq("organization_id", organizationId)
      .order("paid_at", { ascending: false })
      .limit(12)

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: organization.id,
          name: organization.name,
          subscription_status: organization.subscription_status,
          subscription_plan: organization.subscription_plan,
          trial_ends_at: organization.trial_ends_at,
          subscription_ends_at: organization.subscription_ends_at,
          cancel_at_period_end: organization.cancel_at_period_end,
          stripe_customer_id: organization.stripe_customer_id,
        },
        invoices: invoices || [],
        currentPlan,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
