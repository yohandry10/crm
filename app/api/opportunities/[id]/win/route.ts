import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { logError } from '@/lib/error-logging'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import crypto from 'crypto'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        // 1. Update opportunity status
        const { data, error } = await supabase
            .from('opportunities')
            .update({
                status: 'won',
                probability: 100,
                actual_close_date: new Date().toISOString()
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
            endpoint: `/api/opportunities/[id]/win`,
            method: "POST",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
