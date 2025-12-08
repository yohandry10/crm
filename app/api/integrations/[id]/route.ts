import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { z } from 'zod'
import crypto from "crypto"
import { testConnection } from "@/lib/integrations"

const updateIntegrationSchema = z.object({
    name: z.string().min(1).optional(),
    provider: z.enum(['stripe', 'mercadopago', 'whatsapp', 'email', 'calendar']).optional(),
    config: z.record(z.any()).optional(),
    is_active: z.boolean().optional()
})

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("integrations")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (error) throw error

        // Test connection status on fetch
        const connectionResult = await testConnection(data.provider, data.config)
        const enrichedData = {
            ...data,
            connection_status: connectionResult.success ? "connected" : "error",
            last_check: new Date().toISOString()
        }

        return NextResponse.json({ success: true, data: enrichedData })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/integrations/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = updateIntegrationSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Datos inválidos",
                details: validation.error.errors
            }, { status: 400 })
        }

        const validatedData: Record<string, any> = { ...validation.data }

        // Test connection before updating
        let connectionResult
        if (validatedData.provider && validatedData.config) {
            connectionResult = await testConnection(validatedData.provider, validatedData.config)
            if (!connectionResult.success) {
                validatedData.status = "error"
            } else {
                validatedData.status = "connected"
            }
        }

        // Get old data for audit
        const { data: oldData } = await supabase
            .from("integrations")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        const { data, error } = await supabase
            .from("integrations")
            .update(validatedData)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        // Audit Log
        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "UPDATE_INTEGRATION",
            table: "integrations",
            recordId: id,
            oldData,
            newData: validatedData,
        })

        return NextResponse.json({ success: true, data, connection: connectionResult })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/integrations/[id]`,
            method: "PUT",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()

        // Get old data for audit
        const { data: oldData } = await supabase
            .from("integrations")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        const { error } = await supabase
            .from("integrations")
            .delete()
            .eq("id", id)
            .eq("organization_id", organizationId)

        if (error) throw error

        // Audit Log
        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "DELETE_INTEGRATION",
            table: "integrations",
            recordId: id,
            oldData,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/integrations/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
