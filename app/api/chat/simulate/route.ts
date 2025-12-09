import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { z } from "zod"

const simulateSchema = z.object({
    conversation_id: z.string(),
    content: z.string().min(1),
})

export async function POST(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = simulateSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: validation.error }, { status: 400 })
        }

        const { conversation_id, content } = validation.data

        // 1. Analyze Sentiment / Intent (Mock AI)
        const lowerContent = content.toLowerCase()
        let metadata: any = { sentiment: 'neutral' }
        let tags: string[] = []

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
        }

        return NextResponse.json({ success: true, data: message, analysis: metadata })

    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
