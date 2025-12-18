import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { logger } from './logger'

interface AdminActionParams {
  supabase: SupabaseClient
  request: NextRequest
  userId: string
  action: string
  resource: string
  resourceId?: string
  details?: any
  success: boolean
}

/**
 * Registra acciones de administración de plataforma
 * Estas acciones son críticas y deben ser auditadas
 */
export async function logAdminAction(params: AdminActionParams) {
  try {
    const ip = params.request.headers.get('x-forwarded-for') ||
               params.request.headers.get('x-real-ip') ||
               'unknown'

    const userAgent = params.request.headers.get('user-agent') || 'unknown'

    const { error } = await params.supabase.from('auditoria').insert({
      usuario_id: params.userId,
      accion: `ADMIN_${params.action.toUpperCase()}`,
      tabla: params.resource,
      registro_id: params.resourceId || 'N/A',
      datos_nuevos: {
        action: params.action,
        resource: params.resource,
        details: params.details,
        success: params.success,
        timestamp: new Date().toISOString(),
      },
      ip_address: ip,
      user_agent: userAgent,
    })

    if (error) {
      logger.error('Error logging admin action', error, { action: params.action, resource: params.resource })
    }

    logger.info('Admin action', {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      success: params.success,
      ip,
    })
  } catch (err) {
    logger.error('Failed to log admin action', err, { action: params.action, resource: params.resource })
  }
}

/**
 * Registra accesos a datos sensibles
 */
export async function logSensitiveDataAccess(params: {
  supabase: SupabaseClient
  request: NextRequest
  userId: string
  dataType: string
  recordCount: number
  filters?: any
}) {
  try {
    const ip = params.request.headers.get('x-forwarded-for') ||
               params.request.headers.get('x-real-ip') ||
               'unknown'

    const userAgent = params.request.headers.get('user-agent') || 'unknown'

    const { error } = await params.supabase.from('auditoria').insert({
      usuario_id: params.userId,
      accion: 'SENSITIVE_DATA_ACCESS',
      tabla: params.dataType,
      registro_id: `bulk_${params.recordCount}`,
      datos_nuevos: {
        dataType: params.dataType,
        recordCount: params.recordCount,
        filters: params.filters,
        timestamp: new Date().toISOString(),
      },
      ip_address: ip,
      user_agent: userAgent,
    })

    if (error) {
      logger.error('Error logging sensitive data access', error, { dataType: params.dataType })
    }

    logger.info('Sensitive data access', {
      userId: params.userId,
      dataType: params.dataType,
      recordCount: params.recordCount,
      ip,
    })
  } catch (err) {
    logger.error('Failed to log sensitive data access', err, { dataType: params.dataType })
  }
}
