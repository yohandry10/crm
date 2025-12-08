import { NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { createCustomerPortalSession, isStripeConfigured } from "@/lib/stripe"

export async function POST() {
  try {
    const { organization, role } = await getAuthenticatedContext()

    // Only owner can access billing portal
    if (role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Solo el owner puede gestionar facturación" },
        { status: 403 }
      )
    }

    if (!isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: "Stripe no está configurado" },
        { status: 400 }
      )
    }

    if (!organization.stripe_customer_id) {
      return NextResponse.json(
        { success: false, error: "No hay información de facturación" },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    
    const session = await createCustomerPortalSession(
      organization.stripe_customer_id,
      `${baseUrl}/settings/billing`
    )

    return NextResponse.json({
      success: true,
      url: session.url,
    })
  } catch (error: any) {
    console.error("Portal error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
