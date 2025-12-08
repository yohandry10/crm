import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from '@/lib/error-handler'
import { z } from 'zod'
import crypto from 'crypto'

const eventSchema = z.object({
    title: z.string().min(1, "Título requerido").max(200),
    start_time: z.string().datetime("Fecha de inicio inválida"),
    end_time: z.string().datetime("Fecha de fin inválida"),
    contact_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    location: z.string().max(200).optional().nullable(),
    all_day: z.boolean().default(false)
})

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const start = searchParams.get('start')
        const end = searchParams.get('end')
        const contact_id = searchParams.get('contact_id')

        let query = supabase
            .from('events')
            .select(`*, contact:contacts(id, name), opportunity:opportunities(id, name)`)
            .eq('organization_id', organizationId)
            .order('start_time', { ascending: true })

        if (start) query = query.gte('start_time', start)
        if (end) query = query.lte('end_time', end)
        if (contact_id) query = query.eq('contact_id', contact_id)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/events", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = eventSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { title, start_time, end_time, contact_id, opportunity_id, description, location, all_day } = validation.data

        const { data, error } = await supabase
            .from('events')
            .insert({
                organization_id: organizationId, created_by: user.id,
                title, start_time, end_time, contact_id, opportunity_id, description, location, all_day: all_day || false
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/events", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
