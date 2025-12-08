import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// GET - Obtener formulario público (para renderizar en sitios externos)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    
    return response
  } catch (error: any) {
    console.error('[Public Forms API] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
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
