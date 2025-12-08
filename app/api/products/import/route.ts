import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"

export async function POST(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()

    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const { data: products } = await request.json()

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: "No hay datos para importar" },
        { status: 400 }
      )
    }

    if (products.length > 1000) {
      return NextResponse.json(
        { success: false, error: "Máximo 1000 registros por importación" },
        { status: 400 }
      )
    }

    const errors: string[] = []
    let imported = 0

    const batchSize = 50
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize)

      const productsToInsert = batch.map((product: any) => ({
        organization_id: organizationId,
        name: product.name,
        sku: product.sku || null,
        description: product.description || null,
        unit_price: product.unit_price || 0,
        cost_price: product.cost_price || 0,
        stock_quantity: product.stock_quantity || 0,
        is_service: false,
        is_active: true,
      }))

      const { data, error } = await supabase
        .from("products")
        .insert(productsToInsert)
        .select("id")

      if (error) {
        errors.push(`Error en lote ${Math.floor(i / batchSize) + 1}: ${error.message}`)
      } else {
        imported += data?.length || 0
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      imported,
      errors,
      total: products.length,
    })
  } catch (error: any) {
    console.error("Import products error:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Error al importar" },
      { status: 500 }
    )
  }
}
