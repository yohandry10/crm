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

    const { data: history } = await supabase
      .from("subscription_history")
      .select("id, amount, currency, status, billing_period, started_at, ended_at, payment_reference, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(12)

    const invoices = (history || []).map((entry: any) => ({
      id: entry.id,
      amount_paid: Math.round(Number(entry.amount || 0) * 100),
      currency: entry.currency || "PEN",
      status: entry.status === "active" ? "paid" : entry.status,
      invoice_pdf: null,
      hosted_invoice_url: null,
      period_start: entry.started_at,
      period_end: entry.ended_at || entry.started_at,
      paid_at: entry.created_at || entry.started_at,
      payment_reference: entry.payment_reference,
      billing_period: entry.billing_period,
    }))

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
          payment_customer_id: null,
        },
        invoices,
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
