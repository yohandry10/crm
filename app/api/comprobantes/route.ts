import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError, BusinessRuleError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const comprobanteSchema = z.object({
    tipo: z.enum(['factura', 'boleta', 'nota_credito', 'nota_debito']),
    invoice_id: z.string().uuid().optional(),
    
    // Cliente
    cliente_tipo_doc: z.enum(['6', '1', '0']), // 6=RUC, 1=DNI, 0=Otros
    cliente_num_doc: z.string().min(8).max(11),
    cliente_nombre: z.string().min(1),
    cliente_direccion: z.string().optional(),
    
    // Montos
    moneda: z.enum(['PEN', 'USD']).default('PEN'),
    subtotal: z.number().min(0),
    igv: z.number().min(0),
    total: z.number().min(0),
    
    // Items
    items: z.array(z.object({
        descripcion: z.string(),
        cantidad: z.number().positive(),
        precio_unitario: z.number().min(0),
        igv: z.number().min(0),
        total: z.number().min(0),
    })).min(1),
})

export async function GET(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()
        
        const searchParams = request.nextUrl.searchParams
        const tipo = searchParams.get('tipo')
        const estado = searchParams.get('estado')
        const desde = searchParams.get('desde')
        const hasta = searchParams.get('hasta')
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const offset = (page - 1) * limit

        let query = supabase
            .from('comprobantes_electronicos')
            .select('*', { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('fecha_emision', { ascending: false })
            .range(offset, offset + limit - 1)

        if (tipo) query = query.eq('tipo', tipo)
        if (estado) query = query.eq('estado', estado)
        if (desde) query = query.gte('fecha_emision', desde)
        if (hasta) query = query.lte('fecha_emision', hasta)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/comprobantes", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = comprobanteSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        // Validar RUC para facturas
        if (validation.data.tipo === 'factura' && validation.data.cliente_tipo_doc !== '6') {
            throw new BusinessRuleError("Las facturas requieren RUC del cliente")
        }

        // Obtener configuración de la organización para series (ahora está en organizations)
        const { data: settings } = await supabase
            .from('organizations')
            .select('serie_factura, serie_boleta, serie_nota_credito')
            .eq('id', organizationId)
            .single()

        // Determinar serie según tipo
        let serie = 'F001'
        switch (validation.data.tipo) {
            case 'factura': serie = settings?.serie_factura || 'F001'; break
            case 'boleta': serie = settings?.serie_boleta || 'B001'; break
            case 'nota_credito': serie = settings?.serie_nota_credito || 'FC01'; break
            case 'nota_debito': serie = 'FD01'; break
        }

        // Obtener siguiente número correlativo
        const { data: lastDoc } = await supabase
            .from('comprobantes_electronicos')
            .select('numero')
            .eq('organization_id', organizationId)
            .eq('tipo', validation.data.tipo)
            .eq('serie', serie)
            .order('numero', { ascending: false })
            .limit(1)
            .single()

        const numero = (lastDoc?.numero || 0) + 1

        // Crear comprobante - MULTI-TENANT
        const { data, error } = await supabase
            .from('comprobantes_electronicos')
            .insert({
                organization_id: organizationId,
                created_by: user.id,
                invoice_id: validation.data.invoice_id,
                tipo: validation.data.tipo,
                serie,
                numero,
                fecha_emision: new Date().toISOString().split('T')[0],
                cliente_tipo_doc: validation.data.cliente_tipo_doc,
                cliente_num_doc: validation.data.cliente_num_doc,
                cliente_nombre: validation.data.cliente_nombre,
                cliente_direccion: validation.data.cliente_direccion,
                moneda: validation.data.moneda,
                subtotal: validation.data.subtotal,
                igv: validation.data.igv,
                total: validation.data.total,
                estado: 'borrador'
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ 
            success: true, 
            data,
            message: `Comprobante ${serie}-${numero.toString().padStart(8, '0')} creado`
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/comprobantes", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
