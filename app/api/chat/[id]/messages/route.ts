import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 100 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 50 }

// GET: List messages for a conversation
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const rateLimitResponse = await rateLimit(request, READ_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId } = await getAuthenticatedContext()
        const { id } = await params

        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('organization_id', organizationId)
            .eq('conversation_id', id)
            .order('created_at', { ascending: true })

        if (error) throw error

        // Manually fetch sender profiles to avoid joining auth.users which lacks full_name
        const senderIds = Array.from(new Set(data.map(m => m.sender_id).filter(Boolean))) as string[]

        let profilesMap: Record<string, any> = {}
        if (senderIds.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, full_name, avatar_url')
                .in('id', senderIds)

            profiles?.forEach(p => { profilesMap[p.id] = p })
        }

        const enrichedData = data.map(m => ({
            ...m,
            sender: m.sender_id ? profilesMap[m.sender_id] : null
        }))

        return NextResponse.json({ success: true, data: enrichedData })


    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

const createMessageSchema = z.object({
    content: z.string().min(1),
    content_type: z.enum(['text', 'image', 'file', 'template', 'note']).default('text'),
    direction: z.enum(['outbound', 'inbound']).default('outbound'),
    conversation_id: z.string() // Explicitly required for validation even if in params
})

// POST: Send a message
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId, user } = await getAuthenticatedContext()
        const { id } = await params
        const body = await request.json()

        // Inject conversation_id from params into body for validation
        const validation = createMessageSchema.safeParse({ ...body, conversation_id: id })

        if (!validation.success) {
            return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
        }

        // 1. Insert Message
        const { data, error } = await supabase
            .from('messages')
            .insert({
                organization_id: organizationId,
                conversation_id: id,
                sender_id: user.id, // Internal user sending
                direction: validation.data.direction, // Usually outbound
                content: validation.data.content,
                content_type: validation.data.content_type,
                status: 'sent'
            })
            .select()
            .single()

        if (error) throw error

        // 2. Trigger auto-update of conversation timestamp (Handled by DB Trigger, but good to know)

        // 3. (Future) Trigger external provider (WhatsApp/Email API) here

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
