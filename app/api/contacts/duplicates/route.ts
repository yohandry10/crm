import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function GET(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const email = searchParams.get("email")
    const phone = searchParams.get("phone")
    const name = searchParams.get("name")
    const excludeId = searchParams.get("exclude_id")

    if (!email && !phone && !name) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Buscar duplicados
    let query = supabase
      .from("contacts")
      .select("id, name, email, phone, company")
      .eq("organization_id", organizationId)

    if (excludeId) {
      query = query.neq("id", excludeId)
    }

    // Construir condiciones OR
    const conditions: string[] = []
    if (email) conditions.push(`email.eq.${email}`)
    if (phone) conditions.push(`phone.eq.${phone}`)

    if (conditions.length > 0) {
      query = query.or(conditions.join(","))
    }

    const { data, error } = await query.limit(10)

    if (error) throw error

    // Agregar tipo de match
    const duplicates = (data || []).map(contact => ({
      ...contact,
      match_type: contact.email === email ? "email" : 
                  contact.phone === phone ? "phone" : "name"
    }))

    return NextResponse.json({ success: true, data: duplicates })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
