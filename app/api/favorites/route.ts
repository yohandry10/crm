import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function GET(request: NextRequest) {
  try {
    const { supabase, organizationId, userId } = await getAuthenticatedContext()
    if (!organizationId || !userId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entity_type")

    let query = supabase
      .from("favorites")
      .select("*")
      .eq("user_id", userId)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (entityType) {
      query = query.eq("entity_type", entityType)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, organizationId, userId } = await getAuthenticatedContext()
    if (!organizationId || !userId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { entity_type, entity_id, entity_name } = body

    if (!entity_type || !entity_id) {
      return NextResponse.json(
        { success: false, error: "entity_type y entity_id son requeridos" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("favorites")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        entity_type,
        entity_id,
        entity_name,
      })
      .select()
      .single()

    if (error) {
      // Si ya existe, no es error
      if (error.code === "23505") {
        return NextResponse.json({ success: true, data: null, message: "Ya está en favoritos" })
      }
      throw error
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, userId } = await getAuthenticatedContext()
    if (!userId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entity_type")
    const entityId = searchParams.get("entity_id")

    if (!entityType || !entityId) {
      return NextResponse.json(
        { success: false, error: "entity_type y entity_id son requeridos" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
