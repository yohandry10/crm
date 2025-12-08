import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"

// PUT - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, organizationId, role: currentUserRole } = await getAuthenticatedContext()
    const { id } = await params

    // Only owner/admin can update roles
    if (!["owner", "admin"].includes(currentUserRole)) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para cambiar roles" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { role: newRole } = body

    if (!newRole) {
      return NextResponse.json(
        { success: false, error: "Rol requerido" },
        { status: 400 }
      )
    }

    // Can't change to owner
    if (newRole === "owner") {
      return NextResponse.json(
        { success: false, error: "No puedes asignar el rol de owner" },
        { status: 400 }
      )
    }

    // Verify member belongs to same organization
    const { data: member } = await supabase
      .from("organization_members")
      .select("id, role")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Miembro no encontrado" },
        { status: 404 }
      )
    }

    // Can't change owner's role
    if (member.role === "owner") {
      return NextResponse.json(
        { success: false, error: "No puedes cambiar el rol del owner" },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from("organization_members")
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// DELETE - Remove member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, organizationId, role: currentUserRole } = await getAuthenticatedContext()
    const { id } = await params

    // Only owner/admin can remove members
    if (!["owner", "admin"].includes(currentUserRole)) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para eliminar miembros" },
        { status: 403 }
      )
    }

    // Verify member belongs to same organization
    const { data: member } = await supabase
      .from("organization_members")
      .select("id, role")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single()

    if (!member) {
      return NextResponse.json(
        { success: false, error: "Miembro no encontrado" },
        { status: 404 }
      )
    }

    // Can't remove owner
    if (member.role === "owner") {
      return NextResponse.json(
        { success: false, error: "No puedes eliminar al owner" },
        { status: 400 }
      )
    }

    // Soft delete - set is_active to false
    const { error } = await supabase
      .from("organization_members")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
