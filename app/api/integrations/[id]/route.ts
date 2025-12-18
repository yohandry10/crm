import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { decryptJSON, encryptJSON } from "@/lib/encryption"
import { createRequestLogger } from "@/lib/logger"
import { z } from 'zod'
import crypto from "crypto"
import { testConnection } from "@/lib/integrations"

const updateIntegrationSchema = z.object({
    name: z.string().min(1).optional(),
    provider: z.enum(['stripe', 'mercadopago', 'whatsapp', 'email', 'calendar']).optional(),
    config: z.record(z.any()).optional(),
    is_active: z.boolean().optional()
})

function tryDecryptIntegrationConfig(integration: any, log: ReturnType<typeof createRequestLogger>) {
    if (integration?.config_encrypted) {
        try {
            return decryptJSON(integration.config_encrypted)
        } catch (error) {
            log.warn('Failed to decrypt integration config', { integrationId: integration?.id })
            return null
        }
    }

    return integration?.config ?? null
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const log = createRequestLogger(request)
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
        if (rateLimitResponse) return rateLimitResponse

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

        const decryptedConfig = tryDecryptIntegrationConfig(data, log)

        // Test connection status on fetch
        const connectionResult = await testConnection(data.provider, decryptedConfig || {})
        const enrichedData = {
            ...data,
            config: decryptedConfig,
            config_encrypted: undefined,
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
    const log = createRequestLogger(request)
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
        if (rateLimitResponse) return rateLimitResponse

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

        // Get old data for audit + to build a complete connection test input
        const { data: oldData } = await supabase
            .from("integrations")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        const decryptedOldConfig = oldData ? tryDecryptIntegrationConfig(oldData, log) : null

        const updateData: Record<string, any> = {}
        if (validation.data.name !== undefined) updateData.name = validation.data.name
        if (validation.data.provider !== undefined) updateData.provider = validation.data.provider
        if (validation.data.is_active !== undefined) updateData.is_active = validation.data.is_active

        // Always store config encrypted to avoid plaintext credentials
        let decryptedNewConfig: Record<string, any> | null = decryptedOldConfig
        if (validation.data.config !== undefined) {
            decryptedNewConfig = validation.data.config || {}
            try {
                updateData.config_encrypted = encryptJSON(decryptedNewConfig)
                updateData.config = null
            } catch (encryptError) {
                log.error('Failed to encrypt integration config', encryptError, { integrationId: id })
                return NextResponse.json(
                    { success: false, error: "Error al encriptar la configuración" },
                    { status: 500 }
                )
            }
        }

        // Test connection before updating
        let connectionResult: any
        const providerToTest = (updateData.provider ?? oldData?.provider) as string | undefined
        if (providerToTest) {
            connectionResult = await testConnection(providerToTest as any, decryptedNewConfig || {})
            if (!connectionResult.success) {
                updateData.status = "error"
            } else {
                updateData.status = "connected"
            }
        }

        const { data, error } = await supabase
            .from("integrations")
            .update(updateData)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        // Audit Log
        const maskedNewData = {
            ...body,
            config: body.config ? "[ENCRYPTED]" : undefined,
            config_encrypted: undefined,
        }

        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "UPDATE_INTEGRATION",
            table: "integrations",
            recordId: id,
            oldData,
            newData: maskedNewData,
        })

        return NextResponse.json({
            success: true,
            data: {
                ...data,
                config: decryptedNewConfig,
                config_encrypted: undefined,
            },
            connection: connectionResult
        })
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
    const log = createRequestLogger(request)
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rateLimitResponse) return rateLimitResponse

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
        log.error("DELETE /api/integrations/[id] error", error)
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
