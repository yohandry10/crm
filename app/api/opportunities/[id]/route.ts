import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { requireCanManageRecord, requireRolePermission } from '@/lib/role-permissions'
import crypto from 'crypto'
import { z } from 'zod'

const opportunityUpdateSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(200).optional(),
    contact_id: z.string().uuid("ID de contacto inválido").nullable().optional(),
    stage_id: z.string().uuid("ID de etapa inválido").nullable().optional(),
    expected_revenue: z.number().min(0, "El valor debe ser positivo").optional(),
    expected_close_date: z.string().nullable().optional(),
    description: z.string().max(1000, "Máximo 1000 caracteres").nullable().optional(),
    probability: z.number().min(0, "Mínimo 0%").max(100, "Máximo 100%").optional(),
}).strict()

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
        if (rateLimitResponse) return rateLimitResponse

        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from('opportunities')
            .select(`
                *,
                contact:contacts(id, name, email, phone),
                stage:pipeline_stages(id, name, color)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/opportunities/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    let requestBody: any = undefined
    try {
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
        if (rateLimitResponse) return rateLimitResponse

        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "opportunities", "can_update")
        requestBody = await request.json()

        const validation = opportunityUpdateSchema.safeParse(requestBody)
        if (!validation.success) {
            return NextResponse.json(
                { success: false, error: "Datos inválidos", details: validation.error.errors },
                { status: 400 }
            )
        }

        const updateData: Record<string, any> = { ...validation.data }
        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { success: false, error: "No hay campos válidos para actualizar" },
                { status: 400 }
            )
        }

        // Get old data for event emission
        const { data: oldData } = await supabase
            .from('opportunities')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (!oldData) {
            return NextResponse.json({ success: false, error: "Opportunity not found" }, { status: 404 })
        }
        await requireCanManageRecord(supabase, { role, resource: "opportunities", recordOwnerId: oldData.created_by, userId: user.id })

        if (updateData.contact_id) {
            const { data: contact, error: contactError } = await supabase
                .from('contacts')
                .select('id')
                .eq('id', updateData.contact_id)
                .eq('organization_id', organizationId)
                .maybeSingle()

            if (contactError) throw contactError
            if (!contact) {
                return NextResponse.json(
                    { success: false, error: "El contacto seleccionado no existe o no pertenece a tu organización" },
                    { status: 400 }
                )
            }
        }

        const stageChanged =
            Object.prototype.hasOwnProperty.call(updateData, 'stage_id') &&
            updateData.stage_id !== oldData.stage_id

        if (stageChanged && updateData.stage_id) {
            const { data: newStage, error: stageError } = await supabase
                .from('pipeline_stages')
                .select('id, win_probability')
                .eq('id', updateData.stage_id)
                .eq('organization_id', organizationId)
                .maybeSingle()

            if (stageError) throw stageError
            if (!newStage) {
                return NextResponse.json(
                    { success: false, error: "La etapa seleccionada no existe o no pertenece a tu organización" },
                    { status: 400 }
                )
            }

            if (newStage?.win_probability !== null && newStage?.win_probability !== undefined) {
                updateData.probability = newStage.win_probability
            }
        }
        updateData.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('opportunities')
            .update(updateData)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        // ✅ FIX ERROR-API-003: Emit opportunity.updated event on stage changes
        if (stageChanged) {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'opportunity.updated',
                source: 'api/opportunities/[id]',
                payload: {
                    opportunityId: data.id,
                    opportunity: data,
                    organizationId,
                    oldStageId: oldData.stage_id,
                    newStageId: updateData.stage_id,
                    userId: user.id
                }
            })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/opportunities/[id]`,
            method: "PATCH",
            error,
            requestBody,
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
        const rateLimitResponse = await rateLimit(request, RATE_LIMITS.write)
        if (rateLimitResponse) return rateLimitResponse

        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "opportunities", "can_delete")

        // Verify the opportunity exists
        const { data: existing, error: checkError } = await supabase
            .from('opportunities')
            .select('id, created_by')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Oportunidad no encontrada" }, { status: 404 })
        }
        await requireCanManageRecord(supabase, { role, resource: "opportunities", recordOwnerId: existing.created_by, userId: user.id })

        // Check for dependencies before deletion
        const { checkDependencies } = await import('@/lib/dependency-checker')
        const dependencyCheck = await checkDependencies(supabase, 'opportunities', id, organizationId)

        if (dependencyCheck.hasDependencies) {
            return NextResponse.json({
                success: false,
                error: "No se puede eliminar esta oportunidad porque tiene registros relacionados",
                dependencies: dependencyCheck.dependencies
            }, { status: 409 })
        }

        const { error } = await supabase
            .from('opportunities')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/opportunities/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
