import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { logAudit } from "@/lib/audit"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { requireCanManageRecord, requireRolePermission } from "@/lib/role-permissions"
import { z } from "zod"
import crypto from "crypto"

const productUpdateSchema = z.object({
    sku: z.string().optional().nullable(),
    name: z.string().min(1, "Nombre requerido").optional(),
    description: z.string().optional().nullable(),
    category_id: z.string().uuid().optional().nullable(),
    unit_price: z.number().min(0, "Precio debe ser positivo").optional(),
    cost_price: z.number().min(0).optional().nullable(),
    currency: z.enum(['PEN', 'USD']).optional(),
    tax_rate: z.number().min(0).max(100).optional(),
    is_service: z.boolean().optional(),
    is_active: z.boolean().optional(),
    stock_quantity: z.number().int().min(0).optional(),
    min_stock: z.number().int().min(0).optional(),
    image_url: z.string().url().optional().nullable(),
})

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from('products')
            .select('*, category:product_categories(id, name)')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (error) throw error
        if (!data) {
            return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/products/[id]", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "products", "can_update")
        const body = await request.json()

        const validation = productUpdateSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        // Verificar que el producto pertenece a la organización
        const { data: existing, error: checkError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 })
        }
        await requireCanManageRecord(supabase, { role, resource: "products", recordOwnerId: existing.created_by, userId: user.id })

        const { data, error } = await supabase
            .from('products')
            .update({ ...validation.data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "UPDATE_PRODUCT",
            table: "products",
            recordId: id,
            oldData: existing,
            newData: data,
        })

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/products/[id]", method: "PUT", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "products", "can_delete")

        // Verificar que el producto pertenece a la organización
        const { data: existing, error: checkError } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Producto no encontrado" }, { status: 404 })
        }
        await requireCanManageRecord(supabase, { role, resource: "products", recordOwnerId: existing.created_by, userId: user.id })

        // Check for dependencies before deletion
        const { checkDependencies } = await import('@/lib/dependency-checker')
        const dependencyCheck = await checkDependencies(supabase, 'products', id, organizationId)

        if (dependencyCheck.hasDependencies) {
            return NextResponse.json({
                success: false,
                error: "No se puede eliminar este producto porque tiene registros relacionados",
                dependencies: dependencyCheck.dependencies
            }, { status: 409 })
        }

        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "DELETE_PRODUCT",
            table: "products",
            recordId: id,
            oldData: existing,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/products/[id]", method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
