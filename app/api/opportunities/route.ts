import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
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
        const log = createRequestLogger(request)
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        log.debug("Opportunities list requested", { organizationId })

        const searchParams = request.nextUrl.searchParams
        const stage_id = searchParams.get('stage_id')
        const contact_id = searchParams.get('contact_id')
        const status = searchParams.get('status')

        // ✅ FIX CRÍTICO-P1: Add pagination with safe limits
        const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
        const offset = (page - 1) * limit

        let query = supabase
            .from('opportunities')
            .select(`*, contact:contacts(id, name, email, phone), stage:pipeline_stages(id, name, color)`, { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (stage_id) query = query.eq('stage_id', stage_id)
        if (contact_id) query = query.eq('contact_id', contact_id)
        if (status) query = query.eq('status', status)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: {
                page,
                limit,
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit),
                hasNext: page < Math.ceil((count || 0) / limit),
                hasPrev: page > 1
            }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/opportunities", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const log = createRequestLogger(request)
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        log.info("Opportunity create requested", { organizationId, userId: user.id })

        const validation = opportunitySchema.safeParse(body)
        if (!validation.success) {
            log.warn("Opportunity validation failed", { organizationId, userId: user.id })
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.errors }, { status: 400 })
        }

        const { name, contact_id, stage_id, expected_revenue, expected_close_date, description, probability } = validation.data

        // SEGURIDAD: Usar SOLO cliente autenticado con RLS (NO Service Client)
        // Resuelve: SEC-003 del reporte forense

        // Mapeo de IDs semánticos a nombres de stage
        const stageNameMap: Record<string, { name: string, position: number, probability: number }> = {
            'prospecting': { name: 'Prospección', position: 1, probability: 10 },
            'qualification': { name: 'Calificación', position: 2, probability: 25 },
            'proposal': { name: 'Propuesta', position: 3, probability: 50 },
            'negotiation': { name: 'Negociación', position: 4, probability: 75 },
            'closed_won': { name: 'Ganado', position: 5, probability: 100 },
            'closed_lost': { name: 'Perdido', position: 6, probability: 0 },
        }

        // Obtener o crear el stage
        let finalStageId = stage_id
        let finalProbability = probability

        if (stage_id && stageNameMap[stage_id]) {
            // Es un ID semántico, buscar o crear el stage en la BD
            const stageInfo = stageNameMap[stage_id]

            // Buscar stage existente por nombre (RLS protege organization_id)
            const { data: existingStage } = await supabase
                .from('pipeline_stages')
                .select('id, win_probability')
                .eq('name', stageInfo.name)
                .single()

            if (existingStage) {
                finalStageId = existingStage.id
                if (!finalProbability) finalProbability = existingStage.win_probability
            } else {
                // Crear el stage (RLS automáticamente setea organization_id)
                const { data: newStage, error: stageError } = await supabase
                    .from('pipeline_stages')
                    .insert({
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
                    log.error("Error creating stage", stageError, { organizationId, userId: user.id })
                    throw stageError
                }
                finalStageId = newStage.id
                if (!finalProbability) finalProbability = stageInfo.probability
            }
        } else if (!stage_id) {
            // No se proporcionó stage, usar el primero disponible o crear uno por defecto
            const { data: defaultStage } = await supabase
                .from('pipeline_stages')
                .select('id, win_probability')
                .order('position', { ascending: true })
                .limit(1)
                .single()

            if (defaultStage) {
                finalStageId = defaultStage.id
                if (!finalProbability) finalProbability = defaultStage.win_probability
            } else {
                // Crear stage por defecto (RLS protege)
                const { data: newStage, error: stageError } = await supabase
                    .from('pipeline_stages')
                    .insert({
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

        // Verificar que el contact_id sea válido (RLS protege)
        if (contact_id) {
            const { data: contact } = await supabase
                .from('contacts')
                .select('id')
                .eq('id', contact_id)
                .single()

            if (!contact) {
                return NextResponse.json({ success: false, error: "El contacto seleccionado no existe o no pertenece a tu organización" }, { status: 400 })
            }
        } else {
            return NextResponse.json({ success: false, error: "Debes seleccionar un contacto" }, { status: 400 })
        }

        // Insertar oportunidad (RLS protege organization_id y permisos)
        const { data, error } = await supabase
            .from('opportunities')
            .insert({
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
            log.error("Error inserting opportunity", error, { organizationId, userId: user.id })
            throw error
        }

        try {
            const { emitEvent } = await import('@/lib/events')
            await emitEvent({
                event_type: 'opportunity.created', source: 'api/opportunities',
                payload: { id: data.id, organization_id: organizationId, user_id: user.id, contact_id: data.contact_id, opportunity: data }
            })
        } catch (eventErr) {
            log.error("Error emitting event", eventErr, { organizationId, userId: user.id })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        const log = createRequestLogger(request)
        log.error("Opportunity POST error", error)
        return NextResponse.json({ success: false, error: error.message || sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
