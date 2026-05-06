import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { createRequestLogger } from '@/lib/logger'
import { PAGINATION } from '@/lib/pagination'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'
import { z } from 'zod'

const formIdSchema = z.string().uuid()
const submissionsQuerySchema = z.object({
  status: z.enum(['new', 'processed', 'spam']).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.MAX_PAGE_SIZE).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// GET - Listar envíos de un formulario
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const log = createRequestLogger(request)
  try {
    const { id } = await params
    const formId = formIdSchema.safeParse(id)
    if (!formId.success) {
      return NextResponse.json({ error: 'Formulario inválido' }, { status: 400 })
    }

    const searchParams = request.nextUrl.searchParams
    const queryParams = submissionsQuerySchema.safeParse({
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || undefined,
      offset: searchParams.get('offset') || undefined,
    })

    if (!queryParams.success) {
      return NextResponse.json(
        { error: 'Filtros inválidos', details: queryParams.error.flatten() },
        { status: 400 }
      )
    }

    const { supabase, organizationId } = await getAuthenticatedContext()
    const { status, limit, offset } = queryParams.data

    const { data: form, error: formError } = await supabase
      .from('web_forms')
      .select('id')
      .eq('id', formId.data)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (formError) throw formError
    if (!form) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    let query = supabase
      .from('form_submissions')
      .select(`
        id, organization_id, form_id, data, contact_id,
        ip_address, user_agent, referrer,
        utm_source, utm_medium, utm_campaign,
        status, processed_at, processed_by, created_at,
        contact:contacts(id, name, email, phone, lead_status)
      `, { count: 'exact' })
      .eq('organization_id', organizationId)
      .eq('form_id', form.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: submissions, error, count } = await query

    if (error) throw error
    log.info('[Form Submissions API] Listed submissions', {
      formId: form.id,
      organizationId,
      count: submissions?.length ?? 0,
    })

    return NextResponse.json({
      submissions,
      total: count || 0,
      limit,
      offset
    })
  } catch (error: any) {
    log.error('[Form Submissions API] Error', error)
    return NextResponse.json(
      { error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
