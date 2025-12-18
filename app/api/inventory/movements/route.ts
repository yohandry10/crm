import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const movementSchema = z.object({
    product_id: z.string().uuid("ID de producto inválido"),
    type: z.enum(['in', 'out', 'adjustment'], { errorMap: () => ({ message: "Tipo debe ser 'in', 'out' o 'adjustment'" }) }),
    quantity: z.number().positive("Cantidad debe ser positiva"),
    reason: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
    reference_type: z.string().max(50).optional(),
    reference_id: z.string().uuid().optional()
})

/**
 * GET /api/inventory/movements
 * Returns inventory movement history with pagination
 */
export async function GET(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const searchParams = request.nextUrl.searchParams

        // Pagination
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const offset = (page - 1) * limit

        // Filters
        const inventoryId = searchParams.get("inventory_id")
        const type = searchParams.get("type") // 'in', 'out', 'adjustment'

        let query = supabase
            .from("inventory_movements")
            .select(`
                *,
                product:products(id, name, sku),
                performed_by_user:profiles!performed_by(id, email)
            `, { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (inventoryId) {
            query = query.eq("product_id", inventoryId)
        }

        if (type) {
            query = query.eq("type", type)
        }

        const { data, error, count } = await query

        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/inventory/movements",
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

/**
 * POST /api/inventory/movements
 * Records a new inventory movement (in/out/adjustment)
 */
export async function POST(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = movementSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { product_id, type, quantity, reason, notes, reference_type, reference_id } = validation.data

        // Get current product to calculate new quantity
        const { data: product, error: productError } = await supabase
            .from("products")
            .select("stock_quantity, is_service")
            .eq("id", product_id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)
            .single()

        if (productError || !product) {
            return NextResponse.json({
                success: false,
                error: "Producto no encontrado o no es físico"
            }, { status: 404 })
        }

        const currentQuantity = Number(product.stock_quantity || 0)
        let newQuantity = currentQuantity

        // Calculate new quantity based on movement type
        switch (type) {
            case 'in':
                newQuantity = currentQuantity + Number(quantity)
                break
            case 'out':
                newQuantity = currentQuantity - Number(quantity)
                if (newQuantity < 0) {
                    return NextResponse.json({
                        success: false,
                        error: "Insufficient inventory. Current quantity: " + currentQuantity
                    }, { status: 400 })
                }
                break
            case 'adjustment':
                newQuantity = Number(quantity) // Direct set
                break
        }

        // Start transaction: Create movement and update inventory - MULTI-TENANT
        const { data: movement, error: movementError } = await supabase
            .from("inventory_movements")
            .insert({
                organization_id: organizationId,
                product_id,
                type,
                quantity: Math.abs(Number(quantity)),
                previous_quantity: currentQuantity,
                new_quantity: newQuantity,
                reason,
                notes,
                reference_type,
                reference_id,
                performed_by: user.id
            })
            .select()
            .single()

        if (movementError) throw movementError

        // Update product stock_quantity
        const { error: updateError } = await supabase
            .from("products")
            .update({ stock_quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq("id", product_id)
            .eq("organization_id", organizationId)
            .eq("is_service", false)

        if (updateError) {
            // Rollback movement if inventory update fails
            await supabase.from("inventory_movements").delete().eq("id", movement.id)
            throw updateError
        }

        return NextResponse.json({ success: true, data: movement })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: "/api/inventory/movements",
            method: "POST",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
