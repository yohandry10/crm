import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { createRequestLogger } from '@/lib/logger'
import { getHttpStatusForError, sanitizeErrorForClient, ValidationError } from '@/lib/error-handler'
import { createSlugFromName, validateWebFormAssignee, webFormApiSchema } from '@/lib/web-form-contracts'

// GET - Listar formularios de la organización
export async function GET(request: NextRequest) {
  try {
    const { supabase, organizationId } = await getAuthenticatedContext()

    const { data: forms, error } = await supabase
      .from('web_forms')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return NextResponse.json(forms)
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
  }
}

// POST - Crear nuevo formulario
export async function POST(request: NextRequest) {
  try {
    const { supabase, user, organizationId } = await getAuthenticatedContext()

    const body = await request.json()
    const validation = webFormApiSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.format())
    }

    const formInput = validation.data
    await validateWebFormAssignee(supabase, organizationId, formInput.assigned_to)

    // Generar slug único
    const baseSlug = createSlugFromName(formInput.name)

    // Verificar si el slug ya existe
    const { data: existing } = await supabase
      .from('web_forms')
      .select('slug')
      .eq('organization_id', organizationId)
      .like('slug', `${baseSlug}%`)

    let slug = baseSlug
    const existingSlugs = new Set((existing || []).map((row: { slug: string }) => row.slug))
    let suffix = 2
    while (existingSlugs.has(slug)) {
      slug = `${baseSlug}-${suffix}`
      suffix += 1
    }

    const { data: form, error } = await supabase
      .from('web_forms')
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        name: formInput.name,
        slug,
        description: formInput.description,
        fields: formInput.fields,
        settings: formInput.settings,
        theme: formInput.theme,
        redirect_url: formInput.redirect_url,
        success_message: formInput.success_message,
        auto_create_contact: formInput.auto_create_contact,
        default_lead_status: formInput.default_lead_status,
        default_lead_source: formInput.default_lead_source,
        default_tags: formInput.default_tags,
        assigned_to: formInput.assigned_to,
        notify_emails: formInput.notify_emails,
        notify_on_submit: formInput.notify_on_submit
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(form, { status: 201 })
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
  }
}
