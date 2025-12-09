import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 60 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, READ_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId } = await getAuthenticatedContext()
        const searchParams = request.nextUrl.searchParams
        const status = searchParams.get('status')

        let query = supabase
            .from('conversations')
            .select(`
                *,
                contact:contacts(id, name, email, phone),
                channel:channels(type, identifier),
                last_message:messages(content, content_type, created_at)
            `)
            .eq('organization_id', organizationId)
            .order('last_message_at', { ascending: false })

        if (status) {
            query = query.eq('status', status)
        }

        const search = searchParams.get('search')
        if (search) {
            // 1. Find contacts matching the search term
            const { data: foundContacts } = await supabase
                .from('contacts')
                .select('id')
                .eq('organization_id', organizationId)
                .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
                .limit(50)

            const contactIds = foundContacts?.map(c => c.id) || []

            // 2. Filter conversations by these contacts OR subject
            const orConditions = [`subject.ilike.%${search}%`]
            if (contactIds.length > 0) {
                orConditions.push(`contact_id.in.(${contactIds.join(',')})`)
            }

            query = query.or(orConditions.join(','))
        }

        const { data, error } = await query

        if (error) throw error

        // Process data to get the absolute last message (Supabase join returns array)
        const processedData = data?.map(conv => ({
            ...conv,
            last_message: Array.isArray(conv.last_message) ? conv.last_message[0] : conv.last_message
        }))

        return NextResponse.json({ success: true, data: processedData })
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

const createConversationSchema = z.object({
    contact_id: z.string().nullable().optional(),
    channel_id: z.string().nullable().optional(),
    subject: z.string().nullable().optional(),
})

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId, user } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = createConversationSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos: " + validation.error.issues.map(i => i.message).join(", ") }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('conversations')
            .insert({
                organization_id: organizationId,
                contact_id: validation.data.contact_id,
                channel_id: validation.data.channel_id,
                subject: validation.data.subject,
                assigned_to: user.id
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
