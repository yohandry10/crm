import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import crypto from 'crypto'

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

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

        // ✅ FIX ERROR-LOGIC-006: Auto-sync probability on stage change
        let updateData = { ...body }
        if (body.stage_id && body.stage_id !== oldData.stage_id) {
            const { data: newStage } = await supabase
                .from('pipeline_stages')
                .select('win_probability')
                .eq('id', body.stage_id)
                .single()

            if (newStage?.win_probability !== null && newStage?.win_probability !== undefined) {
                updateData.probability = newStage.win_probability
            }
        }

        const { data, error } = await supabase
            .from('opportunities')
            .update(updateData)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        // ✅ FIX ERROR-API-003: Emit opportunity.updated event on stage changes
        if (body.stage_id && body.stage_id !== oldData.stage_id) {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'opportunity.updated',
                source: 'api/opportunities/[id]',
                payload: {
                    opportunityId: data.id,
                    opportunity: data,
                    organizationId,
                    oldStageId: oldData.stage_id,
                    newStageId: body.stage_id,
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
        const { supabase, organizationId } = await getAuthenticatedContext()

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
