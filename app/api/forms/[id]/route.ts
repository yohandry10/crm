import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { createRequestLogger } from '@/lib/logger'

// GET - Obtener formulario por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const log = createRequestLogger(request)
    const { id } = await params
    const supabase = await createSupabaseRouteHandler()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: form, error } = await supabase
      .from('web_forms')
      .select('*, form_submissions(count)')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!form) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    return NextResponse.json(form)
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Actualizar formulario
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const log = createRequestLogger(request)
    const { id } = await params
    const supabase = await createSupabaseRouteHandler()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { name, description, fields, settings, theme, redirect_url, success_message,
            auto_create_contact, default_lead_status, default_lead_source, default_tags,
            assigned_to, notify_emails, notify_on_submit, is_active } = body

    const { data: form, error } = await supabase
      .from('web_forms')
      .update({
        name,
        description,
        fields,
        settings,
        theme,
        redirect_url,
        success_message,
        auto_create_contact,
        default_lead_status,
        default_lead_source,
        default_tags,
        assigned_to,
        notify_emails,
        notify_on_submit,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(form)
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE - Eliminar formulario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const log = createRequestLogger(request)
    const { id } = await params
    const supabase = await createSupabaseRouteHandler()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('web_forms')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
