import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Public API - no auth required
export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data, error } = await supabase
      .from("subscription_plans")
      .select("id, name, display_name, description, price_monthly, price_yearly, max_users, max_contacts, max_invoices_month, features")
      .eq("is_active", true)
      .order("sort_order")

    if (error) throw error

    // Parse features JSON if needed
    const plans = data?.map(plan => ({
      ...plan,
      features: typeof plan.features === "string" ? JSON.parse(plan.features) : plan.features || []
    })) || []

    return NextResponse.json({ success: true, data: plans })
  } catch (error: any) {
    console.error("Error fetching plans:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
