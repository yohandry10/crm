import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { createRequestLogger } from '@/lib/logger'

// GET - Listar formularios de la organización
export async function GET(_request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandler()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    // Obtener organization_id del usuario
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.current_organization_id) {
      return NextResponse.json({ error: 'Sin organización' }, { status: 400 })
    }

    const { data: forms, error } = await supabase
      .from('web_forms')
      .select('*')
      .eq('organization_id', profile.current_organization_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(forms)
  } catch (error: any) {
    const log = createRequestLogger(_request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - Crear nuevo formulario
export async function POST(request: NextRequest) {
  try {
    const log = createRequestLogger(request)
    const supabase = await createSupabaseRouteHandler()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('current_organization_id')
      .eq('id', user.id)
      .single()

    if (!profile?.current_organization_id) {
      return NextResponse.json({ error: 'Sin organización' }, { status: 400 })
    }

    const body = await request.json()
    const { name, description, fields, settings, theme, redirect_url, success_message,
            auto_create_contact, default_lead_status, default_lead_source, default_tags,
            assigned_to, notify_emails, notify_on_submit } = body

    // Generar slug único
    const baseSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)

    // Verificar si el slug ya existe
    const { data: existing } = await supabase
      .from('web_forms')
      .select('slug')
      .eq('organization_id', profile.current_organization_id)
      .like('slug', `${baseSlug}%`)

    let slug = baseSlug
    if (existing && existing.length > 0) {
      slug = `${baseSlug}-${existing.length + 1}`
    }

    const { data: form, error } = await supabase
      .from('web_forms')
      .insert({
        organization_id: profile.current_organization_id,
        created_by: user.id,
        name,
        slug,
        description,
        fields: fields || [],
        settings: settings || {},
        theme: theme || { primaryColor: '#3b82f6', backgroundColor: '#ffffff' },
        redirect_url,
        success_message: success_message || '¡Gracias! Hemos recibido tu información.',
        auto_create_contact: auto_create_contact ?? true,
        default_lead_status: default_lead_status || 'warm',
        default_lead_source: default_lead_source || 'web_form',
        default_tags: default_tags || [],
        assigned_to,
        notify_emails: notify_emails || [],
        notify_on_submit: notify_on_submit ?? true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(form, { status: 201 })
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
