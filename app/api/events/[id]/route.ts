import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { z } from 'zod'
import crypto from 'crypto'

const updateEventSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
    all_day: z.boolean().optional(),
    contact_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    location: z.string().optional(),
    reminder_minutes: z.number().optional()
})

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from('events')
            .select(`
                *,
                contact:contacts(id, name, email),
                opportunity:opportunities(id, name)
            `)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/events/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = updateEventSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Datos inválidos",
                details: validation.error.errors
            }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('events')
            .update(validation.data)
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/events/[id]`,
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

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/events/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
