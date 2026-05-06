import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { decryptJSON } from "@/lib/encryption"
import { validateOutboundWebhookUrl } from "@/lib/outbound-url-security"
import crypto from "crypto"

type RouteContext = {
    params: Promise<{ id: string }>
}

/**
 * POST /api/integrations/[id]/test
 * Tests connection for an integration
 */
export async function POST(
    request: NextRequest,
    context: RouteContext
) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
        if (rateLimitResponse) return rateLimitResponse

        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await context.params

        // Get integration details
        const { data: integration, error } = await supabase
            .from("integrations")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (error || !integration) {
            return NextResponse.json({
                success: false,
                error: "Integration not found"
            }, { status: 404 })
        }

        const provider = integration.provider ?? integration.type

        let config = integration.config ?? {}
        if (integration.config_encrypted) {
            try {
                config = decryptJSON(integration.config_encrypted)
            } catch {
                config = {}
            }
        }

        // Test connection based on integration type
        let testResult = { success: false, message: "", details: {} }

        switch (provider) {
            case 'whatsapp':
                testResult = await testWhatsAppConnection(config)
                break
            case 'email':
                testResult = await testEmailConnection(config)
                break
            case 'webhook':
                testResult = await testWebhookConnection(config)
                break
            default:
                testResult = {
                    success: false,
                    message: `Testing not implemented for type: ${provider}`,
                    details: {}
                }
        }

        // Update last_sync if successful
        if (testResult.success) {
            await supabase
                .from("integrations")
                .update({
                    last_sync: new Date().toISOString(),
                    status: 'active'
                })
                .eq("id", id)
                .eq("organization_id", organizationId)
        } else {
            await supabase
                .from("integrations")
                .update({ status: 'error' })
                .eq("id", id)
                .eq("organization_id", organizationId)
        }

        return NextResponse.json({
            success: testResult.success,
            message: testResult.message,
            details: testResult.details
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/integrations/[id]/test`,
            method: "POST",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

async function testWhatsAppConnection(config: any): Promise<{ success: boolean, message: string, details: any }> {
    try {
        const { api_url, phone_number } = config || {}

        if (!api_url || !phone_number) {
            return {
                success: false,
                message: "Missing required configuration: api_url or phone_number",
                details: {}
            }
        }

        // TODO: Implement actual WhatsApp Business API test
        // For now, just validate configuration
        return {
            success: true,
            message: "WhatsApp configuration valid (actual API test not implemented yet)",
            details: { phone_number }
        }

    } catch (error: any) {
        return {
            success: false,
            message: error.message,
            details: {}
        }
    }
}

async function testEmailConnection(config: any): Promise<{ success: boolean, message: string, details: any }> {
    try {
        const { provider, from_email } = config || {}

        if (!provider || !from_email) {
            return {
                success: false,
                message: "Missing required configuration: provider or from_email",
                details: {}
            }
        }

        // Email is already configured via Resend, just validate config
        return {
            success: true,
            message: "Email configuration valid",
            details: { provider, from_email }
        }

    } catch (error: any) {
        return {
            success: false,
            message: error.message,
            details: {}
        }
    }
}

async function testWebhookConnection(config: any): Promise<{ success: boolean, message: string, details: any }> {
    try {
        const { url, method = 'POST' } = config || {}

        if (!url) {
            return {
                success: false,
                message: "Missing required configuration: url",
                details: {}
            }
        }

        const urlValidation = await validateOutboundWebhookUrl(url)
        if (!urlValidation.valid) {
            return {
                success: false,
                message: `URL de webhook inválida: ${urlValidation.error}`,
                details: {}
            }
        }

        // Test webhook with ping
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ test: true, timestamp: new Date().toISOString() })
        })

        if (!response.ok) {
            return {
                success: false,
                message: `Webhook returned status ${response.status}`,
                details: { status: response.status, url }
            }
        }

        return {
            success: true,
            message: "Webhook connection successful",
            details: { status: response.status, url }
        }

    } catch (error: any) {
        return {
            success: false,
            message: error.message,
            details: {}
        }
    }
}
