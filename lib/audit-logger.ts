import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { logger } from './logger'
import { logAuditEvent } from './audit'

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
 * Compatibility wrapper for older platform-admin routes.
 * New code should call logAuditEvent directly.
 */
export async function logAdminAction(params: AdminActionParams) {
  try {
    await logAuditEvent({
      supabase: params.supabase,
      request: params.request,
      userId: params.userId,
      action: `ADMIN_${params.action.toUpperCase()}`,
      category: 'admin',
      table: params.resource,
      recordId: params.resourceId,
      metadata: {
        action: params.action,
        resource: params.resource,
        details: params.details,
      },
      success: params.success,
      severity: params.success ? 'info' : 'warn',
    })
  } catch (err) {
    logger.error('Failed to log admin action', err, { action: params.action, resource: params.resource })
  }
}

/**
 * Compatibility wrapper for sensitive data access traces.
 * New code should call logAuditEvent directly.
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
    await logAuditEvent({
      supabase: params.supabase,
      request: params.request,
      userId: params.userId,
      action: 'SENSITIVE_DATA_ACCESS',
      category: 'security',
      table: params.dataType,
      metadata: {
        dataType: params.dataType,
        recordCount: params.recordCount,
        filters: params.filters,
      },
      success: true,
      severity: 'info',
    })
  } catch (err) {
    logger.error('Failed to log sensitive data access', err, { dataType: params.dataType })
  }
}
