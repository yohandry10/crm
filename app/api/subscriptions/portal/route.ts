import { NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"

export async function POST() {
  try {
    const { role } = await getAuthenticatedContext()

    // Only owner can access billing portal
    if (role !== "owner") {
      return NextResponse.json(
        { success: false, error: "Solo el owner puede gestionar facturación" },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: "El portal externo de facturación no está habilitado. Gestiona pagos por Culqi/PagoEfectivo o registro manual.",
      },
      { status: 501 }
    )
  } catch (error: any) {
    console.error("Portal error:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
