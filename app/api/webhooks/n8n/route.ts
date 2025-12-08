import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Fallback para variables de entorno (Next.js a veces no las carga bien en dev)
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://crqnkdpjxeoqkfpttncq.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNycW5rZHBqeGVvcWtmcHR0bmNxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzcwMzE3MiwiZXhwIjoyMDc5Mjc5MTcyfQ.iE4sjwPky0u_NN7_krMOogGPrGUbtN_JhhIqEGmwvTo'
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET || 'n8n_wh_k7X9mP2vL4qR8sT1wY6zN3bF5jH0'

/**
 * Webhook endpoint para recibir acciones de N8N
 * N8N puede enviar datos aquí para actualizar el CRM
 */
export async function POST(request: NextRequest) {
  console.log('[N8N Webhook] POST request received')
  
  try {
    // Validar secret (opcional pero recomendado)
    const authHeader = request.headers.get('x-n8n-secret')
    console.log('[N8N Webhook] Auth check:', { hasSecret: !!N8N_WEBHOOK_SECRET, hasHeader: !!authHeader })
    
    if (N8N_WEBHOOK_SECRET && authHeader !== N8N_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, data, organization_id } = body
    console.log('[N8N Webhook] Body:', { action, organization_id, data })

    if (!action || !organization_id) {
      return NextResponse.json(
        { error: 'Missing required fields: action, organization_id' },
        { status: 400 }
      )
    }

    // Cliente admin de Supabase (usa fallbacks si env vars no están disponibles)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    let result: any = null

    switch (action) {
      // ========== CONTACTS ==========
      case 'create_contact':
        const { data: contact, error: contactErr } = await supabase
          .from('contacts')
          .insert({ ...data, organization_id })
          .select()
          .single()
        if (contactErr) throw contactErr
        result = { contact }
        break

      case 'update_contact':
        const { data: updatedContact, error: updateErr } = await supabase
          .from('contacts')
          .update(data.updates)
          .eq('id', data.contact_id)
          .eq('organization_id', organization_id)
          .select()
          .single()
        if (updateErr) throw updateErr
        result = { contact: updatedContact }
        break

      // ========== LEADS ==========
      case 'update_lead_score':
        const { error: scoreErr } = await supabase
          .from('contacts')
          .update({ lead_score: data.score })
          .eq('id', data.contact_id)
          .eq('organization_id', organization_id)
        if (scoreErr) throw scoreErr
        result = { updated: true }
        break

      case 'update_lead_status':
        const { error: statusErr } = await supabase
          .from('contacts')
          .update({ lead_status: data.status })
          .eq('id', data.contact_id)
          .eq('organization_id', organization_id)
        if (statusErr) throw statusErr
        result = { updated: true }
        break

      // ========== TASKS ==========
      case 'create_task':
        const { data: task, error: taskErr } = await supabase
          .from('tasks')
          .insert({
            organization_id,
            contact_id: data.contact_id || null,
            title: data.title,
            description: data.description || null,
            priority: data.priority || 'medium',
            status: 'pending',
            due_date: data.due_date || null,
            assigned_to: data.assigned_to || null
          })
          .select()
          .single()
        if (taskErr) throw taskErr
        result = { task }
        break

      // ========== NOTES ==========
      case 'add_note':
        const { data: note, error: noteErr } = await supabase
          .from('notes')
          .insert({
            organization_id,
            entity_type: data.entity_type || 'contact',
            entity_id: data.contact_id || data.entity_id,
            content: data.content,
            is_pinned: data.is_pinned || false,
            created_by: data.user_id || null
          })
          .select()
          .single()
        if (noteErr) throw noteErr
        result = { note }
        break

      // ========== ACTIVITIES ==========
      case 'log_activity':
        const { data: activity, error: actErr } = await supabase
          .from('activity_logs')
          .insert({
            organization_id,
            user_id: data.user_id || null,
            action: data.type || 'activity', // 'call', 'email', 'meeting', etc.
            entity_type: 'contact',
            entity_id: data.contact_id,
            entity_name: data.contact_name || null,
            description: data.description,
            metadata: data.metadata || {}
          })
          .select()
          .single()
        if (actErr) throw actErr
        result = { activity }
        break

      // ========== ORDERS ==========
      case 'update_order_status':
        const { error: orderErr } = await supabase
          .from('sales_orders')
          .update({ 
            status: data.status,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.order_id)
          .eq('organization_id', organization_id)
        if (orderErr) throw orderErr
        result = { updated: true }
        break

      // ========== TICKETS ==========
      case 'create_ticket':
        const { data: ticket, error: ticketErr } = await supabase
          .from('tickets')
          .insert({
            organization_id,
            contact_id: data.contact_id || null,
            account_id: data.account_id || null,
            title: data.subject || data.title,
            description: data.description,
            priority: data.priority || 'medium',
            status: 'open',
            assigned_to: data.assigned_to || null,
            tags: data.tags || []
          })
          .select()
          .single()
        if (ticketErr) throw ticketErr
        result = { ticket }
        break

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      action,
      result,
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('[N8N Webhook] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'n8n-webhook',
    timestamp: new Date().toISOString()
  })
}
