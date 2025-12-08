import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { z } from 'zod'
import crypto from 'crypto'

const loseOpportunitySchema = z.object({
    lost_reason: z.string().min(1, "Razón de pérdida requerida").max(500)
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = loseOpportunitySchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Datos inválidos",
                details: validation.error.errors
            }, { status: 400 })
        }

        const { lost_reason } = validation.data

        // 1. Update opportunity status
        const { data, error } = await supabase
            .from('opportunities')
            .update({
                status: 'lost',
                probability: 0,
                actual_close_date: new Date().toISOString(),
                lost_reason
            })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/opportunities/[id]/lose`,
            method: "POST",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
