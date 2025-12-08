import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { content, is_pinned } = body

    const updateData: any = { updated_at: new Date().toISOString() }
    if (content !== undefined) updateData.content = content
    if (is_pinned !== undefined) updateData.is_pinned = is_pinned

    const { data, error } = await supabase
      .from("notes")
      .update(updateData)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
