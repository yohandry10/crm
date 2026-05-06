import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { createRequestLogger } from '@/lib/logger'
import { getHttpStatusForError, sanitizeErrorForClient, ValidationError } from '@/lib/error-handler'
import { validateWebFormAssignee, webFormApiUpdateSchema } from '@/lib/web-form-contracts'

// GET - Obtener formulario por ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()

    const { data: form, error } = await supabase
      .from('web_forms')
      .select('*, form_submissions(count)')
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle()

    if (error) throw error
    if (!form) {
      return NextResponse.json({ error: 'Formulario no encontrado' }, { status: 404 })
    }

    return NextResponse.json(form)
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
  }
}

// PUT - Actualizar formulario
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()

    const body = await request.json()
    const validation = webFormApiUpdateSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError('Datos inválidos', validation.error.format())
    }

    if (Object.keys(validation.data).length === 0) {
      throw new ValidationError('No hay cambios para actualizar')
    }

    await validateWebFormAssignee(supabase, organizationId, validation.data.assigned_to)

    const { data: form, error } = await supabase
      .from('web_forms')
      .update({
        ...validation.data,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('organization_id', organizationId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(form)
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
  }
}

// DELETE - Eliminar formulario
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { supabase, organizationId } = await getAuthenticatedContext()

    const { error } = await supabase
      .from('web_forms')
      .delete()
      .eq('id', id)
      .eq('organization_id', organizationId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    const log = createRequestLogger(request)
    log.error('[Forms API] Error', error)
    return NextResponse.json({ error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
  }
}
