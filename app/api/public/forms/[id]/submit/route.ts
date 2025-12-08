import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// POST - Enviar formulario (público)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { data, utm_source, utm_medium, utm_campaign } = body
    const supabase = getSupabaseAdmin()

    // Obtener IP y User Agent
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 
               request.headers.get('x-real-ip') || 
               '0.0.0.0'
    const userAgent = request.headers.get('user-agent') || ''
    const referrer = request.headers.get('referer') || ''

    // Buscar formulario por ID o slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    
    let formQuery = supabase
      .from('web_forms')
      .select('*')
      .eq('is_active', true)

    if (isUUID) {
      formQuery = formQuery.eq('id', id)
    } else {
      formQuery = formQuery.eq('slug', id)
    }

    const { data: form, error: formError } = await formQuery.single()

    if (formError || !form) {
      return corsResponse({ error: 'Formulario no encontrado o inactivo' }, 404)
    }

    // Validar campos requeridos
    const fields = form.fields as any[]
    for (const field of fields) {
      if (field.required && !data[field.id]) {
        return corsResponse({ 
          error: `El campo "${field.label}" es requerido`,
          field: field.id 
        }, 400)
      }
    }

    // Honeypot check (anti-spam)
    if (form.settings?.honeypot && data._hp_field) {
      // Es spam, pero respondemos como si fuera exitoso
      return corsResponse({
        success: true,
        message: form.success_message,
        redirect_url: form.redirect_url
      })
    }

    // Crear submission
    const { data: submission, error: subError } = await supabase
      .from('form_submissions')
      .insert({
        organization_id: form.organization_id,
        form_id: form.id,
        data,
        ip_address: ip,
        user_agent: userAgent,
        referrer,
        utm_source,
        utm_medium,
        utm_campaign,
        status: 'new'
      })
      .select()
      .single()

    if (subError) throw subError

    // Actualizar contador
    await supabase
      .from('web_forms')
      .update({ submissions_count: form.submissions_count + 1 })
      .eq('id', form.id)

    // Crear contacto si está habilitado
    let contactId = null
    if (form.auto_create_contact) {
      const email = data.email || data.correo
      const name = data.name || data.nombre || data.full_name || data.nombre_completo
      const phone = data.phone || data.telefono || data.tel || data.celular

      if (email || name) {
        // Verificar si ya existe
        if (email) {
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('organization_id', form.organization_id)
            .eq('email', email)
            .single()

          if (existing) {
            contactId = existing.id
          }
        }

        // Crear nuevo si no existe
        if (!contactId) {
          const { data: newContact } = await supabase
            .from('contacts')
            .insert({
              organization_id: form.organization_id,
              name: name || 'Sin nombre',
              email,
              phone,
              lead_status: form.default_lead_status || 'warm',
              source: form.default_lead_source || 'web_form',
              tags: form.default_tags || [],
              assigned_to: form.assigned_to,
              notes: `Capturado desde formulario: ${form.name}`
            })
            .select('id')
            .single()

          if (newContact) {
            contactId = newContact.id
          }
        }

        // Vincular submission con contacto
        if (contactId) {
          await supabase
            .from('form_submissions')
            .update({ contact_id: contactId })
            .eq('id', submission.id)
        }
      }
    }

    // Enviar notificación por email si está configurado
    if (form.notify_on_submit && form.notify_emails?.length > 0) {
      // TODO: Implementar envío de email de notificación
      console.log(`[Forms] Notificar a: ${form.notify_emails.join(', ')}`)
    }

    // Emitir evento para workflows
    try {
      await supabase.from('webhook_events').insert({
        organization_id: form.organization_id,
        event_type: 'form.submitted',
        source: 'web_form',
        payload: {
          form_id: form.id,
          form_name: form.name,
          submission_id: submission.id,
          contact_id: contactId,
          data,
          utm_source,
          utm_medium,
          utm_campaign
        }
      })
    } catch (e) {
      console.error('[Forms] Error emitiendo evento:', e)
    }

    return corsResponse({
      success: true,
      submission_id: submission.id,
      contact_id: contactId,
      message: form.success_message,
      redirect_url: form.redirect_url
    })

  } catch (error: any) {
    console.error('[Public Forms Submit] Error:', error)
    return corsResponse({ error: error.message }, 500)
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

// Helper para respuestas con CORS
function corsResponse(data: any, status = 200) {
  const response = NextResponse.json(data, { status })
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}
