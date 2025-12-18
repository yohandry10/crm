import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { generateAIResponse } from "@/lib/ai"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const { message, conversation_id } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, error: "Message is required" }, { status: 400 })
    }

    const [contactsRes, invoicesRes, tasksRes] = await Promise.all([
      supabase.from('contacts').select('id, name, email, lead_score, lead_status').eq('organization_id', organizationId).order('lead_score', { ascending: false }).limit(10),
      supabase.from('invoices').select('id, invoice_number, total, status, due_date').eq('organization_id', organizationId).limit(10),
      supabase.from('tasks').select('id, title, status, priority, due_date').eq('organization_id', organizationId).eq('status', 'pending').limit(10),
    ])

    const context = { contacts: contactsRes.data || [], invoices: invoicesRes.data || [], tasks: tasksRes.data || [] }
    const aiResult = await generateAIResponse(message, context)

    if (!aiResult.success) {
      return NextResponse.json({ success: false, error: aiResult.error || "Error generating AI response" }, { status: 500 })
    }

    try {
      let activeConversationId = conversation_id
      if (!activeConversationId) {
        const { data: convId } = await supabase.rpc('get_or_create_conversation', { p_org_id: organizationId, p_user_id: user.id, p_title: message.substring(0, 50) })
        activeConversationId = convId
      }

      if (activeConversationId) {
        await supabase.rpc('add_ai_message', { p_conversation_id: activeConversationId, p_role: 'user', p_content: message })
        await supabase.rpc('add_ai_message', { p_conversation_id: activeConversationId, p_role: 'assistant', p_content: aiResult.response })
      }
    } catch (e) {
      log.warn("Could not save chat history", { error: e })
    }

    return NextResponse.json({
      success: true, response: aiResult.response, conversation_id,
      context: { contacts_count: context.contacts.length, invoices_count: context.invoices.length, tasks_count: context.tasks.length }
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const searchParams = request.nextUrl.searchParams
    const conversation_id = searchParams.get("conversation_id")

    if (conversation_id) {
      const { data: messages, error } = await supabase.from('ai_messages').select('*').eq('conversation_id', conversation_id).order('created_at', { ascending: true })
      if (error) throw error
      return NextResponse.json({ success: true, data: messages || [] })
    } else {
      const { data: conversations, error } = await supabase.from('ai_conversations').select('*').eq('organization_id', organizationId).eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50)
      if (error) throw error
      return NextResponse.json({ success: true, data: conversations || [] })
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
  }
}
