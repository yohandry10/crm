import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { salesOrderSchema } from "@/lib/schemas"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { validateSalesOrderReferences } from "@/lib/sales-order-references"
import crypto from "crypto"

const WRITE_LIMIT = RATE_LIMITS.write
const updateSalesOrderSchema = salesOrderSchema.partial()

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from("sales_orders")
            .select("*, account:accounts(id, name), contact:contacts(id, name, email), opportunity:opportunities(id, name)")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle()

        if (error) throw error
        if (!data) {
            throw new ValidationError("Pedido no encontrado")
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/orders/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

async function updateSalesOrder(request: NextRequest, { params }: { params: Promise<{ id: string }> }, method: "PUT" | "PATCH") {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params
        const body = await request.json()

        const validation = updateSalesOrderSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.format() }, { status: 400 })
        }

        if (Object.keys(validation.data).length === 0) {
            throw new ValidationError("No hay cambios para actualizar")
        }

        await validateSalesOrderReferences(supabase, organizationId, validation.data)

        // Get current order to check status change
        const { data: currentOrder, error: currentOrderError } = await supabase
            .from("sales_orders")
            .select("status, items")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle()

        if (currentOrderError) throw currentOrderError
        if (!currentOrder) {
            throw new ValidationError("Pedido no encontrado")
        }

        const { data, error } = await supabase
            .from("sales_orders")
            .update(validation.data)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        // Update inventory when order is completed (and wasn't completed before)
        if (validation.data.status === "completed" && currentOrder?.status !== "completed") {
            const items = validation.data.items || data.items || currentOrder.items || []
            for (const item of items) {
                if (item.product_id && item.quantity) {
                    const { error: stockError } = await supabase.rpc("decrement_stock", {
                        p_product_id: item.product_id,
                        p_quantity: item.quantity
                    })
                    if (stockError) {
                        throw new Error(`No se pudo descontar stock para el producto ${item.product_id}: ${stockError.message}`)
                    }
                }
            }
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/orders/[id]`,
            method,
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return updateSalesOrder(request, context, "PUT")
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    return updateSalesOrder(request, context, "PATCH")
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { error } = await supabase
            .from("sales_orders")
            .delete()
            .eq("id", id)
            .eq("organization_id", organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/orders/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
