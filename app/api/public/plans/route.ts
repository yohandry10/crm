import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { sanitizeErrorForClient } from "@/lib/error-handler"

// Public API - no auth required
export async function GET(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.read)
    if (rate) return rate

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

    const response = NextResponse.json({ success: true, data: plans })
    response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*")
    response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type")
    return response
  } catch (error: any) {
    console.error("Error fetching plans:", error)
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set("Access-Control-Allow-Origin", request.headers.get("origin") || "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  return response
}
