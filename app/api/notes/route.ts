import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function GET(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
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

    const { data, error } = await supabase
      .from("notes")
      .select(`
        *,
        profiles:created_by (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("organization_id", organizationId)
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false })

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
    const { entity_type, entity_id, content } = body

    if (!entity_type || !entity_id || !content) {
      return NextResponse.json(
        { success: false, error: "entity_type, entity_id y content son requeridos" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("notes")
      .insert({
        organization_id: organizationId,
        entity_type,
        entity_id,
        content,
        created_by: userId,
      })
      .select(`
        *,
        profiles:created_by (
          full_name,
          email,
          avatar_url
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
