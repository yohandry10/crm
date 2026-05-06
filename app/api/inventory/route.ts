import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"
import { requireRolePermission } from "@/lib/role-permissions"

// Inventory in this app represents "stock management" for physical products.
// Product creation belongs to /api/products (catalog management).
const inventorySchema = z.object({
    product_id: z.string().uuid("Producto inválido"),
    quantity: z.number().int().min(0, "Cantidad no puede ser negativa"),
})

export async function GET(_request: NextRequest) {
    try {
        const { supabase, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "products", "can_update")

        // Fetch from PRODUCTS table (canonical stock source used across orders/invoicing)
        const { data, error } = await supabase
            .from("products")
            .select(`
                id,
                product_name:name,
                sku,
                quantity:stock_quantity,
                price:unit_price,
                updated_at
            `)
            .eq("organization_id", organizationId)
            .eq("is_service", false) // Only show physical products in inventory
            .order("created_at", { ascending: false })

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = inventorySchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.errors }, { status: 400 })
        }

        const { product_id, quantity } = validation.data

        // Update stock on an existing product (do not create products from Inventory)
        const { data, error } = await supabase
            .from("products")
            .update({
                stock_quantity: quantity,
                updated_at: new Date().toISOString(),
            })
            .eq("id", product_id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)
            .select(`
                id,
                product_name:name,
                sku,
                quantity:stock_quantity,
                price:unit_price,
                updated_at
            `)
            .single()

        if (error) throw error
        if (!data) return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 })

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
