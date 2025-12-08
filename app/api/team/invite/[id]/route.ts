import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"

// DELETE - Cancel invitation
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { supabase, organizationId, role } = await getAuthenticatedContext()
    const { id } = await params

    // Only owner/admin can cancel invitations
    if (!["owner", "admin"].includes(role)) {
      return NextResponse.json(
        { success: false, error: "No tienes permisos para cancelar invitaciones" },
        { status: 403 }
      )
    }

    // Verify invitation belongs to same organization
    const { data: invitation } = await supabase
      .from("organization_invitations")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .is("accepted_at", null)
      .single()

    if (!invitation) {
      return NextResponse.json(
        { success: false, error: "Invitación no encontrada" },
        { status: 404 }
      )
    }

    const { error } = await supabase
      .from("organization_invitations")
      .delete()
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
