import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const campaignSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    description: z.string().optional(),
    type: z.enum(['email', 'whatsapp', 'sms', 'mixed']),
    status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
    target_segment: z.record(z.any()).optional(),
    subject: z.string().optional(),
    content: z.string().optional(),
    scheduled_at: z.string().datetime().optional().nullable(),
    budget: z.number().min(0).default(0),
})

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')
        const type = searchParams.get('type')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '10')
        const offset = (page - 1) * limit

        let query = supabase
            .from('campaigns')
            .select('*', { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (status) query = query.eq('status', status)
        if (type) query = query.eq('type', type)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/campaigns", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = campaignSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        let contactCount = 0
        if (validation.data.target_segment) {
            const { count } = await supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId)
            contactCount = count || 0
        }

        const { data, error } = await supabase
            .from('campaigns')
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id, contact_count: contactCount })
            .select()
            .single()

        if (error) throw error

        // Emit event for workflows
        const { emitEvent } = await import('@/lib/events')
        await emitEvent({
            event_type: 'campaign.created',
            source: 'api/campaigns',
            payload: { ...data, user_id: user.id, organization_id: organizationId }
        }, supabase)

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/campaigns", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
