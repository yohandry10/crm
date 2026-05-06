import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import { sendEmail, isEmailConfigured } from '@/lib/email'
import { createSupabaseServiceClient } from '@/lib/supabase-service'
import { sanitizeErrorForClient } from '@/lib/error-handler'

function escapeHtml(value: unknown): string {
  const str = String(value ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function getSupabaseAdmin() {
  return createSupabaseServiceClient()
}

function getAllowedOrigin(request: NextRequest): string | null {
  const allowed = (process.env.PUBLIC_FORMS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  const origin = request.headers.get('origin')
  const hostOrigin = request.nextUrl.origin

  if (allowed.length === 0) return process.env.NODE_ENV === 'production' ? null : origin || hostOrigin
  if (origin && allowed.includes(origin)) return origin
  if (!origin && allowed.includes(hostOrigin)) return hostOrigin
  return null
}

function validateSubmittedFields(fields: any[], data: Record<string, any>) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Datos inválidos' }
  }

  const fieldMap = new Map((fields || []).map((field: any) => [String(field.id), field]))
  const submittedKeys = Object.keys(data).filter((key) => key !== '_hp_field')

  if (submittedKeys.length > 100) {
    return { valid: false, error: 'Demasiados campos enviados' }
  }

  for (const field of fields || []) {
    const fieldId = String(field.id)
    const value = data[fieldId]
    const isEmpty = value === undefined || value === null || value === ''

    if (field.required && isEmpty) {
      return { valid: false, error: `El campo "${field.label}" es requerido`, field: fieldId }
    }

    if (isEmpty) continue

    if (typeof value === 'string' && value.length > 5000) {
      return { valid: false, error: `El campo "${field.label}" excede el tamaño permitido`, field: fieldId }
    }

    if (field.type === 'email' && (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
      return { valid: false, error: `El campo "${field.label}" debe ser un email válido`, field: fieldId }
    }

    if (field.type === 'number' && Number.isNaN(Number(value))) {
      return { valid: false, error: `El campo "${field.label}" debe ser numérico`, field: fieldId }
    }

    if (field.type === 'select') {
      const options = Array.isArray(field.options) ? field.options.map(String) : []
      if (!options.includes(String(value))) {
        return { valid: false, error: `El campo "${field.label}" tiene una opción inválida`, field: fieldId }
      }
    }

    if (field.type === 'checkbox' && typeof value !== 'boolean') {
      return { valid: false, error: `El campo "${field.label}" debe ser verdadero o falso`, field: fieldId }
    }
  }

  const unknownKey = submittedKeys.find((key) => !fieldMap.has(key))
  if (unknownKey) {
    return { valid: false, error: `Campo no permitido: ${unknownKey}`, field: unknownKey }
  }

  return { valid: true }
}

// POST - Enviar formulario (público)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger(request)
  try {
    const rate = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rate) return rate

    const allowedOrigin = getAllowedOrigin(request)
    if (!allowedOrigin) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
    }

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
      return corsResponse({ error: 'Formulario no encontrado o inactivo' }, 404, allowedOrigin)
    }

    const fields = form.fields as any[]
    const fieldsValidation = validateSubmittedFields(fields, data)
    if (!fieldsValidation.valid) {
      return corsResponse(fieldsValidation, 400, allowedOrigin)
    }

    // Honeypot check (anti-spam)
    if (form.settings?.honeypot && data._hp_field) {
      // Es spam, pero respondemos como si fuera exitoso
      return corsResponse({
        success: true,
        message: form.success_message,
        redirect_url: form.redirect_url
      }, 200, allowedOrigin)
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
      const notifyEmails = (form.notify_emails as any[])
        .filter((e) => typeof e === 'string')
        .map((e) => e.trim())
        .filter(Boolean)

      if (!isEmailConfigured()) {
        log.info('[Forms] Notification requested but email not configured', { notifyEmailsCount: notifyEmails.length })
      } else if (notifyEmails.length > 0) {
        try {
          const fieldsById = new Map((fields || []).map((f: any) => [String(f.id), String(f.label || f.id)]))
          const submittedRows = Object.entries(data || {})
            .filter(([key]) => key !== '_hp_field')
            .slice(0, 50)
            .map(([key, value]) => {
              const label = fieldsById.get(String(key)) || String(key)
              return `
                <tr>
                  <td style="padding: 8px 10px; border-top: 1px solid #e2e8f0; color: #334155; font-size: 13px; width: 35%;">
                    ${escapeHtml(label)}
                  </td>
                  <td style="padding: 8px 10px; border-top: 1px solid #e2e8f0; color: #0f172a; font-size: 13px;">
                    ${escapeHtml(formatValue(value))}
                  </td>
                </tr>
              `
            })
            .join('')

          const html = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.5; color: #0f172a; max-width: 680px; margin: 0 auto; padding: 16px;">
              <h2 style="margin: 0 0 10px 0; font-size: 18px;">Nuevo envío de formulario</h2>
              <p style="margin: 0 0 6px 0; color: #334155; font-size: 14px;">
                <strong>Formulario:</strong> ${escapeHtml(form.name)}
              </p>
              <p style="margin: 0 0 6px 0; color: #334155; font-size: 14px;">
                <strong>Submission ID:</strong> ${escapeHtml(submission.id)}
              </p>
              ${contactId ? `
                <p style="margin: 0 0 6px 0; color: #334155; font-size: 14px;">
                  <strong>Contacto:</strong> ${escapeHtml(contactId)}
                </p>
              ` : ''}
              <div style="margin: 14px 0 10px 0; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tbody>
                    ${submittedRows || `
                      <tr>
                        <td style="padding: 10px; color: #64748b; font-size: 13px;">(Sin datos)</td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
              <p style="margin: 10px 0 0 0; color: #64748b; font-size: 12px;">
                IP: ${escapeHtml(ip)} • Referrer: ${escapeHtml(referrer || '-')} • UTM: ${escapeHtml([utm_source, utm_medium, utm_campaign].filter(Boolean).join(' / ') || '-')}
              </p>
            </div>
          `

          const result = await sendEmail({
            to: notifyEmails,
            subject: `Nuevo envío: ${form.name}`,
            html,
          })

          log.info('[Forms] Notification email result', { success: result.success, notifyEmailsCount: notifyEmails.length })
        } catch (e) {
          log.warn('[Forms] Error enviando notificación por email', { error: e })
        }
      }
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
      log.warn('[Forms] Error emitiendo evento', { error: e })
    }

    return corsResponse({
      success: true,
      submission_id: submission.id,
      contact_id: contactId,
      message: form.success_message,
      redirect_url: form.redirect_url
    }, 200, allowedOrigin)

  } catch (error: any) {
    log.error('[Public Forms Submit] Error', error)
    const origin = getAllowedOrigin(request)
    if (!origin) {
      return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: 500 })
    }
    return corsResponse({ error: sanitizeErrorForClient(error) }, 500, origin)
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request)
  if (!allowedOrigin) return new NextResponse(null, { status: 403 })
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}

// Helper para respuestas con CORS
function corsResponse(data: any, status: number, origin: string) {
  const response = NextResponse.json(data, { status })
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}
