import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const productSchema = z.object({
    sku: z.string().optional(),
    name: z.string().min(1, "Nombre requerido"),
    description: z.string().optional(),
    category_id: z.string().uuid().optional().nullable(),
    unit_price: z.number().min(0, "Precio debe ser positivo"),
    cost_price: z.number().min(0).optional(),
    currency: z.enum(['PEN', 'USD']).default('PEN'),
    tax_rate: z.number().min(0).max(100).default(18),
    is_service: z.boolean().default(false),
    is_active: z.boolean().default(true),
    stock_quantity: z.number().int().min(0).default(0),
    min_stock: z.number().int().min(0).default(0),
    image_url: z.string().url().optional().nullable(),
})

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        
        const searchParams = request.nextUrl.searchParams
        const category_id = searchParams.get('category_id')
        const is_active = searchParams.get('is_active')
        const is_service = searchParams.get('is_service')
        const search = searchParams.get('search')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = (page - 1) * limit

        let query = supabase
            .from('products')
            .select('*, category:product_categories(id, name)', { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1)

        if (category_id) query = query.eq('category_id', category_id)
        if (is_active !== null) query = query.eq('is_active', is_active === 'true')
        if (is_service !== null) query = query.eq('is_service', is_service === 'true')
        if (search) query = query.ilike('name', `%${search}%`)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/products", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = productSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        // Check for duplicate SKU if provided
        if (validation.data.sku) {
            const { data: existingProduct } = await supabase
                .from('products')
                .select('id')
                .eq('organization_id', organizationId)
                .eq('sku', validation.data.sku)
                .single()

            if (existingProduct) {
                throw new ValidationError(`Ya existe un producto con el SKU: ${validation.data.sku}`)
            }
        }

        const { data, error } = await supabase
            .from('products')
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/products", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
