import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'

// GET - Listar envíos de un formulario
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createSupabaseRouteHandler()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

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
      total: count,
      limit,
      offset
    })
  } catch (error: any) {
    console.error('[Form Submissions API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
