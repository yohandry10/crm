import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase credentials for public forms')
  }

  return createClient(
    url,
    serviceKey
  )
}

function getAllowedOrigin(request: NextRequest): string | null {
  const allowed = (process.env.PUBLIC_FORMS_ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  const origin = request.headers.get('origin')
  const hostOrigin = request.nextUrl.origin

  if (allowed.length === 0) return origin || hostOrigin
  if (origin && allowed.includes(origin)) return origin
  if (!origin && allowed.includes(hostOrigin)) return hostOrigin
  return null
}

// GET - Obtener formulario público (para renderizar en sitios externos)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.read)
    if (rate) return rate

    const allowedOrigin = getAllowedOrigin(request)
    if (!allowedOrigin) {
      return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
    }

    const { id } = await params
    const supabase = getSupabaseAdmin()

    // Buscar por ID o por slug
    let query = supabase
      .from('web_forms')
      .select('id, name, description, fields, theme, success_message, redirect_url, settings')
      .eq('is_active', true)

    // Determinar si es UUID o slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    
    if (isUUID) {
      query = query.eq('id', id)
    } else {
      query = query.eq('slug', id)
    }

    const { data: form, error } = await query.single()

    if (error || !form) {
      return NextResponse.json(
        { error: 'Formulario no encontrado o inactivo' },
        { status: 404 }
      )
    }

    // Incrementar contador de vistas
    await supabase.rpc('increment_form_views', { p_form_id: form.id })

    // Headers CORS para permitir embebido
    const response = NextResponse.json(form)
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    
    return response
  } catch (error: any) {
    console.error('[Public Forms API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest) {
  const allowedOrigin = getAllowedOrigin(request) || '*'
  const response = new NextResponse(null, { status: 204 })
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
  return response
}
