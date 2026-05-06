import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { ForbiddenError, sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"
import { encryptSecret, decryptSecret } from "@/lib/encryption"
import { createRequestLogger } from "@/lib/logger"

const settingsSchema = z.object({
    // Company info - accept both formats (company_* and direct)
    name: z.string().optional(),
    company_name: z.string().optional(),
    legal_name: z.string().optional().nullable(),
    ruc: z.string().max(11).optional().nullable(),
    company_ruc: z.string().max(11).optional().nullable(),
    address: z.string().optional().nullable(),
    company_address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    company_phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal("")),
    company_email: z.string().email().optional().nullable().or(z.literal("")),
    timezone: z.string().optional().nullable(),
    currency: z.string().optional().nullable(),
    default_currency: z.string().optional().nullable(),
    logo_url: z.string().url().optional().nullable().or(z.literal("")),
    // SUNAT
    sunat_usuario_sol: z.string().optional().nullable(),
    sunat_clave_sol: z.string().optional().nullable(),
    // Billing series
    serie_factura: z.string().optional().nullable(),
    serie_boleta: z.string().optional().nullable(),
    serie_nota_credito: z.string().optional().nullable(),
    // Defaults
    default_tax_rate: z.union([z.number(), z.string()]).optional().nullable(),
    // Payment methods
    yape_phone: z.string().optional().nullable(),
    yape_qr_url: z.string().url().optional().nullable().or(z.literal("")),
    plin_phone: z.string().optional().nullable(),
    plin_qr_url: z.string().url().optional().nullable().or(z.literal("")),
    bank_name: z.string().optional().nullable(),
    bank_account: z.string().optional().nullable(),
    bank_cci: z.string().optional().nullable(),
    bank_holder: z.string().optional().nullable(),
    // Notifications
    notify_new_lead: z.boolean().optional().nullable(),
    notify_task_due: z.boolean().optional().nullable(),
    notify_payment_received: z.boolean().optional().nullable(),
    notify_invoice_overdue: z.boolean().optional().nullable(),
}).passthrough() // Allow extra fields from organizations table

export async function GET(_request: NextRequest) {
    try {
        const log = createRequestLogger(_request)
        const { supabase, organizationId, role } = await getAuthenticatedContext()

        if (!["owner", "admin"].includes(role)) {
            throw new ForbiddenError("Solo owner/admin pueden ver configuración sensible")
        }

        // Get all organization data (now includes settings)
        const { data: org, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', organizationId)
            .single()

        if (error) throw error

        // Decrypt sensitive fields if they are encrypted
        let sunatUsuarioSol = org.sunat_usuario_sol
        let sunatClaveSol = org.sunat_clave_sol
        let oseApiKey = org.ose_api_key

        // Check encrypted columns first
        if (org.sunat_usuario_sol_encrypted) {
            try {
                sunatUsuarioSol = decryptSecret(org.sunat_usuario_sol_encrypted)
            } catch (err) {
                log.error("Failed to decrypt SUNAT usuario", err, { organizationId })
            }
        }

        if (org.sunat_clave_sol_encrypted) {
            try {
                sunatClaveSol = decryptSecret(org.sunat_clave_sol_encrypted)
            } catch (err) {
                log.error("Failed to decrypt SUNAT clave", err, { organizationId })
            }
        }

        if (org.ose_api_key_encrypted) {
            try {
                oseApiKey = decryptSecret(org.ose_api_key_encrypted)
            } catch (err) {
                log.error("Failed to decrypt OSE API key", err, { organizationId })
            }
        }

        // Map to frontend expected format for backwards compatibility
        const data = {
            ...org,
            company_name: org.name,
            company_ruc: org.ruc,
            company_address: org.address,
            company_phone: org.phone,
            company_email: org.email,
            default_currency: org.currency,
            sunat_usuario_sol: sunatUsuarioSol,
            sunat_clave_sol: sunatClaveSol,
            ose_api_key: oseApiKey,
            // Don't expose encrypted columns to client
            sunat_usuario_sol_encrypted: undefined,
            sunat_clave_sol_encrypted: undefined,
            ose_api_key_encrypted: undefined,
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/settings", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PUT(request: NextRequest) {
    try {
        const log = createRequestLogger(request)
        const { supabase, organizationId, role } = await getAuthenticatedContext()

        if (!["owner", "admin"].includes(role)) {
            throw new ForbiddenError("Solo owner/admin pueden modificar configuración")
        }
        const body = await request.json()

        const validation = settingsSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const validData = validation.data

        // Map frontend fields to database fields
        const updateData: Record<string, any> = {
            updated_at: new Date().toISOString(),
        }

        // Company info - accept both formats
        if (body.company_name || validData.name) updateData.name = body.company_name || validData.name
        if (body.company_ruc || validData.ruc) updateData.ruc = body.company_ruc || validData.ruc
        if (body.company_address || validData.address) updateData.address = body.company_address || validData.address
        if (body.company_phone || validData.phone) updateData.phone = body.company_phone || validData.phone
        if (body.company_email || validData.email) updateData.email = body.company_email || validData.email
        if (body.default_currency || validData.currency) updateData.currency = body.default_currency || validData.currency
        if (validData.legal_name) updateData.legal_name = validData.legal_name
        if (validData.timezone) updateData.timezone = validData.timezone

        // SUNAT - encrypt sensitive credentials
        if (validData.sunat_usuario_sol !== undefined) {
            if (validData.sunat_usuario_sol) {
                try {
                    updateData.sunat_usuario_sol_encrypted = encryptSecret(validData.sunat_usuario_sol)
                    updateData.sunat_usuario_sol = null // Clear plaintext
                } catch (err) {
                    log.error("Failed to encrypt SUNAT usuario", err, { organizationId })
                    throw new Error('Error al encriptar credenciales SUNAT')
                }
            } else {
                updateData.sunat_usuario_sol_encrypted = null
                updateData.sunat_usuario_sol = null
            }
        }

        if (validData.sunat_clave_sol !== undefined) {
            if (validData.sunat_clave_sol) {
                try {
                    updateData.sunat_clave_sol_encrypted = encryptSecret(validData.sunat_clave_sol)
                    updateData.sunat_clave_sol = null // Clear plaintext
                } catch (err) {
                    log.error("Failed to encrypt SUNAT clave", err, { organizationId })
                    throw new Error('Error al encriptar credenciales SUNAT')
                }
            } else {
                updateData.sunat_clave_sol_encrypted = null
                updateData.sunat_clave_sol = null
            }
        }

        // Billing series
        if (validData.serie_factura) updateData.serie_factura = validData.serie_factura
        if (validData.serie_boleta) updateData.serie_boleta = validData.serie_boleta
        if (validData.serie_nota_credito) updateData.serie_nota_credito = validData.serie_nota_credito

        // Defaults
        if (validData.default_tax_rate !== undefined) updateData.default_tax_rate = validData.default_tax_rate

        // Notifications
        if (validData.notify_new_lead !== undefined) updateData.notify_new_lead = validData.notify_new_lead
        if (validData.notify_task_due !== undefined) updateData.notify_task_due = validData.notify_task_due
        if (validData.notify_payment_received !== undefined) updateData.notify_payment_received = validData.notify_payment_received
        if (validData.notify_invoice_overdue !== undefined) updateData.notify_invoice_overdue = validData.notify_invoice_overdue

        // Payment methods
        if (validData.logo_url !== undefined) updateData.logo_url = validData.logo_url || null
        if (validData.yape_phone !== undefined) updateData.yape_phone = validData.yape_phone || null
        if (validData.yape_qr_url !== undefined) updateData.yape_qr_url = validData.yape_qr_url || null
        if (validData.plin_phone !== undefined) updateData.plin_phone = validData.plin_phone || null
        if (validData.plin_qr_url !== undefined) updateData.plin_qr_url = validData.plin_qr_url || null
        if (validData.bank_name !== undefined) updateData.bank_name = validData.bank_name || null
        if (validData.bank_account !== undefined) updateData.bank_account = validData.bank_account || null
        if (validData.bank_cci !== undefined) updateData.bank_cci = validData.bank_cci || null
        if (validData.bank_holder !== undefined) updateData.bank_holder = validData.bank_holder || null

        // Obtener datos actuales para comparar
        const { data: currentData, error: fetchError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', organizationId)
            .single()

        if (fetchError) throw fetchError

        // Comparar si hay cambios reales (excluyendo updated_at)
        const fieldsToCompare = ['name', 'ruc', 'address', 'phone', 'email', 'currency', 'timezone',
            'serie_factura', 'serie_boleta', 'serie_nota_credito', 'default_tax_rate',
            'notify_new_lead', 'notify_task_due', 'notify_payment_received', 'notify_invoice_overdue',
            'logo_url', 'yape_phone', 'yape_qr_url', 'plin_phone', 'plin_qr_url',
            'bank_name', 'bank_account', 'bank_cci', 'bank_holder',
            'sunat_usuario_sol_encrypted', 'sunat_clave_sol_encrypted']

        const hasRealChanges = fieldsToCompare.some(field => {
            if (!(field in updateData)) return false
            const newValue = String(updateData[field] ?? '')
            const currentValue = String(currentData[field] ?? '')
            return newValue !== currentValue
        })

        if (!hasRealChanges) {
            return NextResponse.json({
                success: false,
                error: "No hay cambios para guardar. Los datos ya están actualizados."
            }, { status: 400 })
        }

        // Update organizations table directly
        const { data, error } = await supabase
            .from('organizations')
            .update(updateData)
            .eq('id', organizationId)
            .select()
            .single()

        if (error) throw error

        // Decrypt sensitive fields for response
        let sunatUsuarioSol = null
        let sunatClaveSol = null

        if (data.sunat_usuario_sol_encrypted) {
            try {
                sunatUsuarioSol = decryptSecret(data.sunat_usuario_sol_encrypted)
            } catch (err) {
                log.error("Failed to decrypt SUNAT usuario in response", err, { organizationId })
            }
        }

        if (data.sunat_clave_sol_encrypted) {
            try {
                sunatClaveSol = decryptSecret(data.sunat_clave_sol_encrypted)
            } catch (err) {
                log.error("Failed to decrypt SUNAT clave in response", err, { organizationId })
            }
        }

        // Return with backwards compatible field names
        const responseData = {
            ...data,
            company_name: data.name,
            company_ruc: data.ruc,
            company_address: data.address,
            company_phone: data.phone,
            company_email: data.email,
            default_currency: data.currency,
            sunat_usuario_sol: sunatUsuarioSol,
            sunat_clave_sol: sunatClaveSol,
            // Don't expose encrypted columns
            sunat_usuario_sol_encrypted: undefined,
            sunat_clave_sol_encrypted: undefined,
            ose_api_key_encrypted: undefined,
        }

        return NextResponse.json({ success: true, data: responseData })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/settings", method: "PUT", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
