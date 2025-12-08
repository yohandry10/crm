import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, NotFoundError, BusinessRuleError } from "@/lib/error-handler"
import crypto from "crypto"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/contacts/[id]/convert
 * Convierte un lead a cliente:
 * 1. Actualiza lead_status a "converted"
 * 2. Opcionalmente crea una cuenta (si tiene empresa)
 * 3. Opcionalmente crea una oportunidad
 * 4. Emite evento lead.converted para workflows
 */
export async function POST(request: NextRequest, context: RouteContext) {
    const { id } = await context.params
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json().catch(() => ({}))

        const { create_opportunity, opportunity_name, expected_revenue, create_account } = body

        // 1. Obtener el contacto/lead
        const { data: contact, error: contactError } = await supabase
            .from("contacts")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (contactError || !contact) {
            throw new NotFoundError("Contacto no encontrado")
        }

        // 2. Verificar que no esté ya convertido
        if (contact.lead_status === "converted") {
            throw new BusinessRuleError("Este lead ya fue convertido anteriormente")
        }

        // 3. Verificar que sea un lead válido (no lost)
        if (contact.lead_status === "lost") {
            throw new BusinessRuleError("No se puede convertir un lead marcado como perdido")
        }

        const results: {
            contact: any
            account?: any
            opportunity?: any
        } = { contact: null }

        // 4. Crear cuenta si tiene empresa y se solicita
        if (create_account && contact.company) {
            const { data: existingAccount } = await supabase
                .from("accounts")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("name", contact.company)
                .single()

            if (!existingAccount) {
                const { data: newAccount, error: accountError } = await supabase
                    .from("accounts")
                    .insert({
                        organization_id: organizationId,
                        created_by: user.id,
                        name: contact.company,
                        industry: contact.industry || null,
                        website: contact.website || null,
                        phone: contact.phone || null,
                        status: "active"
                    })
                    .select()
                    .single()

                if (!accountError && newAccount) {
                    results.account = newAccount

                    // Vincular contacto a la cuenta
                    await supabase
                        .from("contacts")
                        .update({ account_id: newAccount.id })
                        .eq("id", id)
                }
            } else {
                results.account = existingAccount
                // Vincular contacto a la cuenta existente
                await supabase
                    .from("contacts")
                    .update({ account_id: existingAccount.id })
                    .eq("id", id)
            }
        }

        // 5. Crear oportunidad si se solicita
        if (create_opportunity) {
            // Obtener la primera etapa del pipeline
            const { data: firstStage } = await supabase
                .from("pipeline_stages")
                .select("id, win_probability")
                .eq("organization_id", organizationId)
                .order("position", { ascending: true })
                .limit(1)
                .single()

            const { data: opportunity, error: oppError } = await supabase
                .from("opportunities")
                .insert({
                    organization_id: organizationId,
                    created_by: user.id,
                    name: opportunity_name || `Oportunidad - ${contact.name}`,
                    contact_id: id,
                    account_id: results.account?.id || contact.account_id || null,
                    stage_id: firstStage?.id || null,
                    expected_revenue: expected_revenue || 0,
                    probability: firstStage?.win_probability || 50,
                    status: "open"
                })
                .select()
                .single()

            if (!oppError && opportunity) {
                results.opportunity = opportunity
            }
        }

        // 6. Actualizar el lead a convertido
        const { data: updatedContact, error: updateError } = await supabase
            .from("contacts")
            .update({
                lead_status: "converted",
                converted_at: new Date().toISOString(),
                converted_by: user.id,
                updated_at: new Date().toISOString()
            })
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (updateError) throw updateError

        results.contact = updatedContact

        // 7. Registrar auditoría
        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "CONVERT_LEAD",
            table: "contacts",
            recordId: id,
            oldData: contact,
            newData: {
                ...updatedContact,
                account_created: !!results.account,
                opportunity_created: !!results.opportunity
            }
        })

        // 8. Emitir evento para workflows
        const { emitEvent } = await import("@/lib/events")
        await emitEvent({
            event_type: "contact.updated",
            source: "api/contacts/convert",
            payload: {
                id: updatedContact.id,
                organization_id: organizationId,
                user_id: user.id,
                old_status: contact.lead_status,
                new_status: "converted",
                conversion: {
                    account_id: results.account?.id,
                    opportunity_id: results.opportunity?.id
                }
            }
        }, supabase as any)

        return NextResponse.json({
            success: true,
            message: "Lead convertido exitosamente",
            data: results
        })

    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/contacts/${id}/convert`,
            method: "POST",
            error,
            requestBody: await request.clone().json().catch(() => undefined)
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
