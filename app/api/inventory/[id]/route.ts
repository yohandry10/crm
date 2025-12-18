import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const inventoryUpdateSchema = z.object({
    quantity: z.number().int().min(0, "Cantidad no puede ser negativa").optional(),
    price: z.number().min(0, "Precio no puede ser negativo").optional(),
})

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

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
            .eq("id", id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)
            .single()

        if (error) throw error
        if (!data) {
            return NextResponse.json({ success: false, error: "Item no encontrado" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory/[id]", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = inventoryUpdateSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.errors }, { status: 400 })
        }

        // Verificar que el producto pertenece a la organización (y es físico)
        const { data: existing, error: checkError } = await supabase
            .from("products")
            .select("id")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Item no encontrado" }, { status: 404 })
        }

        const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (typeof validation.data.quantity === "number") updatePayload.stock_quantity = validation.data.quantity
        if (typeof validation.data.price === "number") updatePayload.unit_price = validation.data.price

        const { data, error } = await supabase
            .from("products")
            .update(updatePayload)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory/[id]", method: "PUT", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

        // In inventory module we don't delete products; that's handled in Products with dependency checks.
        const { data: existing, error: checkError } = await supabase
            .from("products")
            .select("id")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Item no encontrado" }, { status: 404 })
        }

        return NextResponse.json({ success: false, error: "No se puede eliminar desde Inventario. Ve a Productos." }, { status: 400 })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory/[id]", method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
