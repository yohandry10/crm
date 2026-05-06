import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"
import { requireRolePermission } from "@/lib/role-permissions"

// Bulk delete invoices (only drafts can be deleted)
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, organizationId, role } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }
    await requireRolePermission(supabase, role, "invoices", "can_delete")

    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de IDs" },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { success: false, error: "Máximo 100 registros por operación" },
        { status: 400 }
      )
    }

    // Only allow deleting draft invoices
    const { error, count } = await supabase
      .from("invoices")
      .delete()
      .eq("organization_id", organizationId)
      .eq("status", "draft")
      .in("id", ids)

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      deleted: count || 0,
      message: count === 0 ? "Solo se pueden eliminar facturas en borrador" : undefined
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Bulk update invoices (e.g., change status)
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, organizationId, role } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }
    await requireRolePermission(supabase, role, "invoices", "can_update")

    const { ids, updates } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requiere un array de IDs" },
        { status: 400 }
      )
    }

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: "Se requieren campos a actualizar" },
        { status: 400 }
      )
    }

    // Only allow certain fields to be bulk updated
    const allowedFields = ["status"]
    const filteredUpdates: Record<string, any> = {}
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay campos válidos para actualizar" },
        { status: 400 }
      )
    }

    // Validate status transitions
    const validStatuses = ["draft", "sent", "paid", "overdue", "cancelled"]
    if (filteredUpdates.status && !validStatuses.includes(filteredUpdates.status)) {
      return NextResponse.json(
        { success: false, error: "Estado inválido" },
        { status: 400 }
      )
    }

    const { error, count } = await supabase
      .from("invoices")
      .update(filteredUpdates)
      .eq("organization_id", organizationId)
      .in("id", ids)

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      updated: count || ids.length 
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
