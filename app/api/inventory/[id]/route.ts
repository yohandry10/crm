import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const inventoryUpdateSchema = z.object({
    product_name: z.string().min(1, "Nombre de producto requerido").max(200).optional(),
    sku: z.string().max(50).optional().nullable(),
    quantity: z.number().int().min(0, "Cantidad no puede ser negativa").optional(),
    price: z.number().min(0, "Precio no puede ser negativo").optional(),
    min_stock: z.number().int().min(0).optional(),
    category: z.string().max(100).optional().nullable(),
    description: z.string().max(500).optional().nullable()
})

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("inventory")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
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

        // Verificar que el item pertenece a la organización
        const { data: existing, error: checkError } = await supabase
            .from("inventory")
            .select("id")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Item no encontrado" }, { status: 404 })
        }

        const { data, error } = await supabase
            .from("inventory")
            .update({ ...validation.data, updated_at: new Date().toISOString() })
            .eq("id", id)
            .eq("organization_id", organizationId)
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

        // Verificar que el item pertenece a la organización
        const { data: existing, error: checkError } = await supabase
            .from("inventory")
            .select("id")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Item no encontrado" }, { status: 404 })
        }

        const { error } = await supabase
            .from("inventory")
            .delete()
            .eq("id", id)
            .eq("organization_id", organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory/[id]", method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
