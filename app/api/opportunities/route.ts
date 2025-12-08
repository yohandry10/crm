import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { z } from 'zod'
import crypto from 'crypto'

const opportunitySchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(200),
    contact_id: z.string().optional().nullable(),
    stage_id: z.string().optional().nullable(),
    expected_revenue: z.number().min(0).optional(),
    expected_close_date: z.string().optional().nullable(),
    description: z.string().max(1000).optional().nullable(),
    probability: z.number().min(0).max(100).optional()
})

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()

        const searchParams = request.nextUrl.searchParams
        const stage_id = searchParams.get('stage_id')
        const contact_id = searchParams.get('contact_id')
        const status = searchParams.get('status')

        let query = supabase
            .from('opportunities')
            .select(`*, contact:contacts(id, name, email, phone), stage:pipeline_stages(id, name, color)`)
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })

        if (stage_id) query = query.eq('stage_id', stage_id)
        if (contact_id) query = query.eq('contact_id', contact_id)
        if (status) query = query.eq('status', status)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/opportunities", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        console.log("Opportunity POST body:", body)

        const validation = opportunitySchema.safeParse(body)
        if (!validation.success) {
            console.log("Validation errors:", validation.error.errors)
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.errors }, { status: 400 })
        }

        const { name, contact_id, stage_id, expected_revenue, expected_close_date, description, probability } = validation.data

        // Mapeo de IDs semánticos a nombres de stage
        const stageNameMap: Record<string, { name: string, position: number, probability: number }> = {
            'prospecting': { name: 'Prospección', position: 1, probability: 10 },
            'qualification': { name: 'Calificación', position: 2, probability: 25 },
            'proposal': { name: 'Propuesta', position: 3, probability: 50 },
            'negotiation': { name: 'Negociación', position: 4, probability: 75 },
            'closed_won': { name: 'Ganado', position: 5, probability: 100 },
            'closed_lost': { name: 'Perdido', position: 6, probability: 0 },
        }

        // Usar service role para operaciones de BD
        const { createSupabaseServiceClient } = await import("@/lib/supabase-service")
        const supabaseAdmin = createSupabaseServiceClient()

        // Obtener o crear el stage
        let finalStageId = stage_id
        let finalProbability = probability

        if (stage_id && stageNameMap[stage_id]) {
            // Es un ID semántico, buscar o crear el stage en la BD
            const stageInfo = stageNameMap[stage_id]

            // Buscar stage existente por nombre
            const { data: existingStage } = await supabaseAdmin
                .from('pipeline_stages')
                .select('id, win_probability')
                .eq('organization_id', organizationId)
                .eq('name', stageInfo.name)
                .single()

            if (existingStage) {
                finalStageId = existingStage.id
                if (!finalProbability) finalProbability = existingStage.win_probability
            } else {
                // Crear el stage
                const { data: newStage, error: stageError } = await supabaseAdmin
                    .from('pipeline_stages')
                    .insert({
                        organization_id: organizationId,
                        name: stageInfo.name,
                        position: stageInfo.position,
                        win_probability: stageInfo.probability,
                        color: '#3b82f6',
                        is_default: stageInfo.position === 1,
                        active: true
                    })
                    .select('id')
                    .single()

                if (stageError) {
                    console.error("Error creating stage:", stageError)
                    throw stageError
                }
                finalStageId = newStage.id
                if (!finalProbability) finalProbability = stageInfo.probability
            }
        } else if (!stage_id) {
            // No se proporcionó stage, usar el primero disponible o crear uno por defecto
            const { data: defaultStage } = await supabaseAdmin
                .from('pipeline_stages')
                .select('id, win_probability')
                .eq('organization_id', organizationId)
                .order('position', { ascending: true })
                .limit(1)
                .single()

            if (defaultStage) {
                finalStageId = defaultStage.id
                if (!finalProbability) finalProbability = defaultStage.win_probability
            } else {
                // Crear stage por defecto
                const { data: newStage, error: stageError } = await supabaseAdmin
                    .from('pipeline_stages')
                    .insert({
                        organization_id: organizationId,
                        name: 'Prospección',
                        position: 1,
                        win_probability: 10,
                        color: '#3b82f6',
                        is_default: true,
                        active: true
                    })
                    .select('id')
                    .single()

                if (stageError) throw stageError
                finalStageId = newStage.id
                finalProbability = 10
            }
        }

        // Verificar que el contact_id sea válido si se proporciona
        if (contact_id) {
            const { data: contact } = await supabaseAdmin
                .from('contacts')
                .select('id')
                .eq('id', contact_id)
                .eq('organization_id', organizationId)
                .single()

            if (!contact) {
                return NextResponse.json({ success: false, error: "El contacto seleccionado no existe o no pertenece a tu organización" }, { status: 400 })
            }
        } else {
            return NextResponse.json({ success: false, error: "Debes seleccionar un contacto" }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('opportunities')
            .insert({
                organization_id: organizationId,
                created_by: user.id,
                name,
                contact_id,
                stage_id: finalStageId,
                expected_revenue: expected_revenue || 0,
                expected_close_date: expected_close_date || null,
                description: description || null,
                probability: finalProbability || 50,
                status: 'open'
            })
            .select()
            .single()

        if (error) {
            console.error("Error inserting opportunity:", error)
            throw error
        }

        try {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'opportunity.created', source: 'api/opportunities',
                payload: { id: data.id, organization_id: organizationId, user_id: user.id, contact_id: data.contact_id, opportunity: data }
            })
        } catch (eventErr) {
            console.error("Error emitting event:", eventErr)
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        console.error("Opportunity POST error:", error)
        return NextResponse.json({ success: false, error: error.message || sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
