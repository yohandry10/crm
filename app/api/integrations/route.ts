import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { z } from "zod"
import crypto from "crypto"
import { testConnection } from "@/lib/integrations"
import { encryptJSON } from "@/lib/encryption"
import { createRequestLogger } from "@/lib/logger"

const integrationSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(100),
    provider: z.string().min(1, "Proveedor requerido"),
    config: z.record(z.any()).optional(),
    is_active: z.boolean().default(true)
})

function toSafeIntegrationResponse(integration: any) {
    const safeIntegration = { ...integration }
    const hasConfig = Boolean(safeIntegration.config_encrypted || safeIntegration.config)
    delete safeIntegration.config_encrypted
    delete safeIntegration.config
    return {
        ...safeIntegration,
        config: null,
        has_config: hasConfig,
    }
}
export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("integrations")
            .select("*")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })

        if (error) throw error

        const decryptedData = data.map(toSafeIntegrationResponse)

        return NextResponse.json({ success: true, data: decryptedData })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/integrations", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    const log = createRequestLogger(request)
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = integrationSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const connectionResult = await testConnection(validation.data.provider, validation.data.config || {})
        const status = connectionResult.success ? "connected" : "error"

        // Encrypt config to avoid storing secrets in plaintext in the DB
        let configEncrypted: string | null = null

        if (body.config) {
            try {
                // Encrypt the entire config as JSON
                configEncrypted = encryptJSON(body.config)
            } catch (encryptError) {
                log.error('Failed to encrypt integration config', encryptError)
                throw new Error('Failed to encrypt sensitive configuration')
            }
        }

        // Prepare data for insertion
        const insertData = {
            name: body.name,
            provider: body.provider,
            description: body.description,
            category: body.category,
            status,
            // Never store config in plaintext; only return decrypted config to the client
            config: null,
            config_encrypted: configEncrypted,
            organization_id: organizationId,
            created_by: user.id,
            is_active: body.is_active
        }

        const { data, error } = await supabase
            .from("integrations")
            .insert(insertData)
            .select()
            .single()

        if (error) throw error

        // Audit log - mask sensitive fields
        const auditData = {
            ...body,
            config: body.config ? '[ENCRYPTED]' : null
        }

        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "CREATE_INTEGRATION",
            table: "integrations",
            recordId: data.id,
            newData: auditData
        })

        const responseData = toSafeIntegrationResponse(data)

        return NextResponse.json({ success: true, data: responseData, connection: connectionResult })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/integrations", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
