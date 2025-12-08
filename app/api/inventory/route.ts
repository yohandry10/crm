import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const inventorySchema = z.object({
    product_name: z.string().min(1, "Nombre de producto requerido").max(200),
    sku: z.string().max(50).optional(),
    quantity: z.number().int().min(0, "Cantidad no puede ser negativa"),
    price: z.number().min(0, "Precio no puede ser negativo"),
    min_stock: z.number().int().min(0).optional(),
    category: z.string().max(100).optional(),
    description: z.string().max(500).optional()
})

export async function GET(_request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("inventory")
            .select("*")
            .eq("organization_id", organizationId)
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

        const { data, error } = await supabase
            .from("inventory")
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/inventory", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
