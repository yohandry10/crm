import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { createRequestLogger } from '@/lib/logger'
import { PAGINATION } from '@/lib/pagination'

// GET - Listar envíos de un formulario
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

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    const rawLimit = parseInt(searchParams.get('limit') || '50')
    const rawOffset = parseInt(searchParams.get('offset') || '0')

    const limit = Math.min(
      PAGINATION.MAX_PAGE_SIZE,
      Math.max(1, Number.isNaN(rawLimit) ? 50 : rawLimit)
    )
    const offset = Math.max(0, Number.isNaN(rawOffset) ? 0 : rawOffset)

    let query = supabase
      .from('form_submissions')
      .select(`
        *,
        contact:contacts(id, name, email, phone, lead_status)
      `, { count: 'exact' })
      .eq('form_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: submissions, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      submissions,
      total: count || 0,
      limit,
      offset
    })
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Form Submissions API] Error', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
