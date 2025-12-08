import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function GET(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get("entity_type")
    const entityId = searchParams.get("entity_id")
    const action = searchParams.get("action")
    const limit = parseInt(searchParams.get("limit") || "50")
    const offset = parseInt(searchParams.get("offset") || "0")

    let query = supabase
      .from("activity_logs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    // Filtros opcionales
    if (entityType) {
      query = query.eq("entity_type", entityType)
    }
    if (entityId) {
      query = query.eq("entity_id", entityId)
    }
    if (action) {
      query = query.eq("action", action)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("Error fetching activity logs:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
      },
    })
  } catch (error: any) {
    console.error("Activity logs error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}

// POST para registrar actividad manual (login, export, etc.)
export async function POST(request: NextRequest) {
  try {
    const { supabase, organizationId, userId } = await getAuthenticatedContext()

    if (!organizationId || !userId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { action, entity_type, entity_id, entity_name, description, metadata } = body

    if (!action || !entity_type) {
      return NextResponse.json(
        { success: false, error: "action y entity_type son requeridos" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("activity_logs")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        action,
        entity_type,
        entity_id: entity_id || null,
        entity_name: entity_name || null,
        description: description || null,
        metadata: metadata || null,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating activity log:", error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error("Activity log create error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Error interno" },
      { status: 500 }
    )
  }
}
