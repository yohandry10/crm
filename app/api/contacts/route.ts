import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { contactSchema } from "@/lib/schemas"
import { rateLimit } from "@/lib/rate-limit"
import crypto from "crypto"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 100 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 30 }

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, READ_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const search = searchParams.get("search")
        const status = searchParams.get("status")
        const tag = searchParams.get("tag")
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "10")
        const offset = (page - 1) * limit

        // Search with organization filter
        if (search && search.trim().length > 0) {
            const { data, error } = await supabase
                .rpc('search_contacts', {
                    p_org_id: organizationId,
                    p_query: search.trim(),
                    p_limit: limit
                })

            if (error) throw error

            return NextResponse.json({
                success: true,
                data,
                pagination: { page, limit, total: data.length }
            })
        }

        // Query with organization filter (RLS also enforces this)
        let query = supabase
            .from("contacts")
            .select("*", { count: "exact" })
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1)

        if (status) query = query.eq("lead_status", status)
        if (tag) query = query.contains("tags", [tag])

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
            endpoint: "/api/contacts",
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function POST(request: NextRequest) {
    console.log("=== CONTACTS API POST: Iniciando ===")
    try {
        console.log("1. Verificando rate limit...")
        const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
        if (rateLimitResponse) {
            console.log("ERROR: Rate limit excedido")
            return rateLimitResponse
        }
        console.log("2. Rate limit OK")

        console.log("3. Obteniendo contexto de autenticación...")
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        console.log("4. Contexto obtenido:", { userId: user?.id, organizationId })

        const body = await request.json()
        console.log("5. Body recibido:", JSON.stringify(body))

        // TEMPORALMENTE DESHABILITADO: verificación de límites del plan
        console.log("6. Plan limits DESHABILITADO - saltando verificación")

        console.log("7. Validando schema...")
        const validation = contactSchema.safeParse(body)

        if (!validation.success) {
            console.log("ERROR: Validación fallida:", validation.error.errors)
            return NextResponse.json({
                success: false,
                error: "Validation failed",
                details: validation.error.errors
            }, { status: 400 })
        }
        console.log("8. Validación OK")

        console.log("9. Creando cliente Supabase admin...")
        const { createSupabaseServiceClient } = await import("@/lib/supabase-service")
        const supabaseAdmin = createSupabaseServiceClient()
        console.log("10. Cliente admin creado")

        console.log("11. Insertando contacto en la BD...")
        const insertData = {
            ...validation.data,
            organization_id: organizationId,
            created_by: user.id,
        }
        console.log("12. Datos a insertar:", JSON.stringify(insertData))

        const { data, error } = await supabaseAdmin
            .from("contacts")
            .insert(insertData)
            .select()
            .single()

        if (error) {
            console.log("ERROR EN INSERT:", error)
            throw error
        }
        console.log("13. Insert exitoso, data:", data?.id)

        console.log("14. Logging audit...")
        try {
            await logAudit({
                supabase,
                request,
                userId: user.id,
                organizationId,
                action: "CREATE_CONTACT",
                table: "contacts",
                recordId: data.id,
                newData: validation.data,
            })
            console.log("15. Audit OK")
        } catch (auditError) {
            console.error("Error en audit (no bloqueante):", auditError)
        }

        console.log("16. Emitiendo evento...")
        try {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'contact.created',
                source: 'internal',
                payload: {
                    id: data.id,
                    organization_id: organizationId,
                    user_id: user.id,
                    name: data.name,
                    email: data.email,
                    lead_status: data.lead_status
                }
            }, supabase as any)
            console.log("17. Evento emitido OK")
        } catch (eventError) {
            console.error("Error en evento (no bloqueante):", eventError)
        }

        console.log("=== CONTACTS API POST: ÉXITO ===")
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.log("=== CONTACTS API POST: ERROR CAPTURADO ===")
        console.log("Error message:", error.message)
        console.log("Error code:", error.code)
        console.log("Error completo:", JSON.stringify(error, null, 2))

        try {
            await logError({
                errorId: crypto.randomUUID(),
                endpoint: "/api/contacts",
                method: "POST",
                error,
            })
        } catch (logErr) {
            console.error("Error logging error:", logErr)
        }

        const status = getHttpStatusForError(error)
        console.log("Status a devolver:", status)

        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status }
        )
    }
}
