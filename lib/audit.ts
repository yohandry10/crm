import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export async function logAudit(params: {
    supabase: SupabaseClient
    request?: NextRequest
    userId: string
    organizationId?: string  // MULTI-TENANT
    action: string
    table: string
    recordId: string
    oldData?: any
    newData?: any
}) {
    try {
        let ip = 'unknown'
        let userAgent = 'unknown'

        if (params.request) {
            ip = params.request.headers.get('x-forwarded-for') ||
                params.request.headers.get('x-real-ip') ||
                'unknown'
            userAgent = params.request.headers.get('user-agent') || 'unknown'
        }

        const { error } = await params.supabase.from('auditoria').insert({
            organization_id: params.organizationId,  // MULTI-TENANT
            usuario_id: params.userId,
            accion: params.action,
            tabla: params.table,
            registro_id: params.recordId,
            datos_anteriores: params.oldData,
            datos_nuevos: params.newData,
            ip_address: ip,
            user_agent: userAgent
        })

        if (error) {
            console.error('Error logging audit:', error)
        }
    } catch (err) {
        console.error('Failed to log audit:', err)
    }
}
