import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"
import { getPaginationParams } from "@/lib/pagination"

const campaignSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    description: z.string().optional().nullable(),
    type: z.enum(['email', 'whatsapp', 'sms', 'mixed']),
    status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']).default('draft'),
    target_segment: z.record(z.any()).optional(),
    subject: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    scheduled_at: z.string().datetime().optional().nullable(),
    budget: z.coerce.number().min(0).default(0),
})

function validateCampaignReadyForStatus(campaign: z.infer<typeof campaignSchema>, contactCount: number) {
    if (campaign.status !== 'active' && campaign.status !== 'scheduled') return

    if (!campaign.content || campaign.content.trim().length === 0) {
        throw new ValidationError("El contenido de la campaña es requerido antes de activar")
    }

    if (campaign.type === 'email' && (!campaign.subject || campaign.subject.trim().length === 0)) {
        throw new ValidationError("El asunto es requerido para campañas de email")
    }

    if (campaign.status === 'scheduled' && !campaign.scheduled_at) {
        throw new ValidationError("La fecha de programación es requerida")
    }

    if (contactCount <= 0) {
        throw new ValidationError("La campaña necesita una audiencia antes de activarse o programarse")
    }
}

async function countCampaignAudience(supabase: any, organizationId: string, targetSegment?: Record<string, any> | null) {
    if (!targetSegment) return 0

    let query = supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)

    switch (targetSegment.type) {
        case 'hot_leads':
            query = query.eq('lead_status', 'hot')
            break
        case 'customers':
            query = query.eq('lead_status', 'converted')
            break
        case 'all_contacts':
        default:
            break
    }

    const { count, error } = await query
    if (error) throw error
    return count || 0
}

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')
        const type = searchParams.get('type')
        const { page, limit, offset } = getPaginationParams(searchParams)

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

        const contactCount = await countCampaignAudience(supabase, organizationId, validation.data.target_segment)

        validateCampaignReadyForStatus(validation.data, contactCount)

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
