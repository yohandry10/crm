import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

// Bulk delete products
export async function DELETE(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

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

    const { error, count } = await supabase
      .from("products")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", ids)

    if (error) throw error

    return NextResponse.json({ 
      success: true, 
      deleted: count || ids.length 
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Bulk update products (e.g., activate/deactivate)
export async function PATCH(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

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
    const allowedFields = ["is_active", "category_id"]
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

    const { error, count } = await supabase
      .from("products")
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
