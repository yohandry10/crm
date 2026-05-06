import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit } from "@/lib/rate-limit"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { validateConversationReferences } from "@/lib/work-item-references"
import { z } from "zod"
const READ_LIMIT = { interval: 60 * 1000, maxRequests: 60 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }
const conversationQuerySchema = z.object({
    status: z.enum(['open', 'closed', 'snoozed']).optional(),
    search: z.string().trim().max(100).optional(),
})

function normalizeSearchTerm(value: string) {
    return value.replace(/[(),]/g, ' ').trim()
}

export async function GET(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, READ_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId } = await getAuthenticatedContext()
        const searchParams = request.nextUrl.searchParams
        const filters = conversationQuerySchema.safeParse({
            status: searchParams.get('status') || undefined,
            search: searchParams.get('search') || undefined,
        })

        if (!filters.success) {
            throw new ValidationError("Filtros inválidos", filters.error.format())
        }

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

        if (filters.data.status) {
            query = query.eq('status', filters.data.status)
        }

        const search = filters.data.search ? normalizeSearchTerm(filters.data.search) : ''
        if (search) {
            // 1. Find contacts matching the search term
            const [contactsByName, contactsByEmail] = await Promise.all([
                supabase
                    .from('contacts')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .ilike('name', `%${search}%`)
                    .limit(50),
                supabase
                    .from('contacts')
                    .select('id')
                    .eq('organization_id', organizationId)
                    .ilike('email', `%${search}%`)
                    .limit(50),
            ])

            if (contactsByName.error) throw contactsByName.error
            if (contactsByEmail.error) throw contactsByEmail.error

            const contactIds = Array.from(new Set([
                ...(contactsByName.data || []).map(c => c.id),
                ...(contactsByEmail.data || []).map(c => c.id),
            ]))

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
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

const createConversationSchema = z.object({
    contact_id: z.string().uuid().nullable().optional(),
    channel_id: z.string().uuid().nullable().optional(),
    subject: z.string().trim().max(200).nullable().optional(),
})

export async function POST(request: NextRequest) {
    try {
        const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
        if (rateLimitResponse) return rateLimitResponse

        const { supabase, organizationId, user } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = createConversationSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        await validateConversationReferences(supabase, organizationId, validation.data)

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
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
