import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { z } from 'zod'
import { createRequestLogger } from '@/lib/logger'
import crypto from 'crypto'
import { requireRolePermission } from '@/lib/role-permissions'

const pipelineStageSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(50),
    position: z.number().int().min(0).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color debe ser hexadecimal (#RRGGBB)").optional(),
    win_probability: z.number().min(0).max(100).optional()
})

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "pipeline_stages", "can_create")
        const log = createRequestLogger(request, organizationId)

        log.debug("Fetching pipeline stages")

        const { data, error } = await supabase
            .from('pipeline_stages')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('active', true)
            .order('position', { ascending: true })

        if (error) {
            log.error("Error fetching pipeline stages", error)
            throw error
        }

        log.debug("Pipeline stages found", { count: data?.length || 0 })

        // Si no hay stages para esta organización, crear los por defecto
        if (!data || data.length === 0) {
            log.info("No pipeline stages found, creating defaults")

            const { createSupabaseServiceClient } = await import("@/lib/supabase-service")
            const supabaseAdmin = createSupabaseServiceClient()

            const defaultStages = [
                { name: 'Prospección', position: 1, win_probability: 10, color: '#64748b', is_default: true },
                { name: 'Calificación', position: 2, win_probability: 25, color: '#3b82f6', is_default: false },
                { name: 'Propuesta', position: 3, win_probability: 50, color: '#eab308', is_default: false },
                { name: 'Negociación', position: 4, win_probability: 75, color: '#f97316', is_default: false },
                { name: 'Ganado', position: 5, win_probability: 100, color: '#22c55e', is_default: false },
                { name: 'Perdido', position: 6, win_probability: 0, color: '#ef4444', is_default: false },
            ]

            const { data: createdStages, error: createError } = await supabaseAdmin
                .from('pipeline_stages')
                .insert(defaultStages.map(s => ({
                    ...s,
                    organization_id: organizationId,
                    active: true
                })))
                .select()

            if (createError) {
                log.error("Error creating default pipeline stages", createError)
                throw createError
            }

            log.info("Created default pipeline stages", { count: createdStages?.length || 0 })
            return NextResponse.json({ success: true, data: createdStages })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/pipeline-stages", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = pipelineStageSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.errors }, { status: 400 })
        }

        const { name, position, color, win_probability } = validation.data

        const { data, error } = await supabase
            .from('pipeline_stages')
            .insert({ organization_id: organizationId, name, position, color, win_probability, active: true })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/pipeline-stages", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
