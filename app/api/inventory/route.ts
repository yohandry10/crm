import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

// Mapped schema to products table
const inventorySchema = z.object({
    product_name: z.string().min(1, "Nombre de producto requerido").max(200),
    sku: z.string().max(50).optional(),
    quantity: z.number().int().min(0, "Cantidad no puede ser negativa"),
    price: z.number().min(0, "Precio no puede ser negativo"),
    min_stock: z.number().int().min(0).optional(),
    description: z.string().max(500).optional()
})

export async function GET(_request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        // Fetch from PRODUCTS table instead of legacy inventory table
        // Map columns to match the InvoiceItem interface expected by frontend
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
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = inventorySchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.errors }, { status: 400 })
        }

        const { product_name, sku, quantity, price, min_stock, description } = validation.data

        // Insert into PRODUCTS table
        const { data, error } = await supabase
            .from("products")
            .insert({
                name: product_name,
                sku,
                stock_quantity: quantity,
                unit_price: price,
                min_stock: min_stock || 0,
                description,
                is_service: false,
                is_active: true,
                organization_id: organizationId,
                created_by: user.id
            })
            .select(`
                id,
                product_name:name,
                sku,
                quantity:stock_quantity,
                price:unit_price,
                updated_at
            `)
            .single()

        if (error) {
            // Check for unique SKU error
            if (error.code === '23505' && error.message?.includes('sku')) {
                return NextResponse.json({ success: false, error: "Ya existe un producto con este SKU" }, { status: 400 })
            }
            throw error
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
