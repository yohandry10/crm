import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { assertConversationInOrganization } from "@/lib/work-item-references"
import { z } from "zod"

const simulateSchema = z.object({
    conversation_id: z.string().uuid(),
    content: z.string().trim().min(1).max(5000),
})

export async function POST(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = simulateSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { conversation_id, content } = validation.data
        await assertConversationInOrganization(supabase, organizationId, conversation_id)

        // 1. Analyze Sentiment / Intent (Mock AI)
        const lowerContent = content.toLowerCase()
        const metadata: any = { sentiment: 'neutral' }
        const tags: string[] = []

        if (lowerContent.match(/(enoj|mal|pesimo|horrible|queja|denuncia|estafa)/)) {
            metadata.sentiment = 'negative'
            metadata.risk = true
            tags.push('Riesgo')
        } else if (lowerContent.match(/(precio|costo|interesa|cotiza|comprar|quiero)/)) {
            metadata.sentiment = 'positive'
            metadata.intent = 'purchase'
            metadata.suggested_action = 'create_opportunity'
            tags.push('Oportunidad')
        }

        // 2. Insert Inbound Message
        const { data: message, error } = await supabase
            .from('messages')
            .insert({
                organization_id: organizationId,
                conversation_id: conversation_id,
                direction: 'inbound', // Customer speaking
                content: content,
                status: 'delivered',
                metadata: metadata
            })
            .select()
            .single()

        if (error) throw error

        // 3. Update Conversation Metadata/Tags
        if (tags.length > 0) {
            // Fetch current metadata
            const { data: conv } = await supabase
                .from('conversations')
                .select('metadata')
                .eq('id', conversation_id)
                .eq('organization_id', organizationId)
                .single()

            const currentTags = conv?.metadata?.tags || []
            const newTags = Array.from(new Set([...currentTags, ...tags]))

            await supabase
                .from('conversations')
                .update({
                    metadata: { ...conv?.metadata, tags: newTags, last_sentiment: metadata.sentiment },
                    status: metadata.risk ? 'open' : 'open' // ensure open
                })
                .eq('id', conversation_id)
                .eq('organization_id', organizationId)
        }

        return NextResponse.json({ success: true, data: message, analysis: metadata })

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
