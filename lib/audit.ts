import { SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { logger } from './logger'
import { createSupabaseServiceClient } from './supabase-service'
import crypto from 'crypto'

type AuditSeverity = 'info' | 'warn' | 'error'
type AuditCategory = 'auth' | 'billing' | 'data' | 'admin' | 'export' | 'security' | 'system'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SENSITIVE_KEY_PATTERN = /password|pass|secret|token|key|credential|authorization|api[_-]?key|config|idempotency/i

function toAuditUuid(value?: string | null) {
    return value && UUID_PATTERN.test(value) ? value : null
}

function getRequestId(request?: Request) {
    return request?.headers.get('x-request-id') || request?.headers.get('x-vercel-id') || crypto.randomUUID()
}

export function getAuditRequestContext(request?: Request) {
    const forwarded = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = request?.headers.get('x-real-ip')?.trim()
    const cfIp = request?.headers.get('cf-connecting-ip')?.trim()
    const ip = forwarded || realIp || cfIp || null
    const userAgent = request?.headers.get('user-agent') || null

    return {
        ipAddress: ip && /^[a-z0-9:.]+$/i.test(ip) ? ip : null,
        userAgent,
        requestId: getRequestId(request),
        device: parseDevice(userAgent),
    }
}

function parseDevice(userAgent: string | null) {
    const value = userAgent || ''
    const os = /Windows/i.test(value)
        ? 'Windows'
        : /Mac OS|Macintosh/i.test(value)
            ? 'macOS'
            : /Android/i.test(value)
                ? 'Android'
                : /iPhone|iPad|iOS/i.test(value)
                    ? 'iOS'
                    : /Linux/i.test(value)
                        ? 'Linux'
                        : 'unknown'

    const browser = /Edg\//i.test(value)
        ? 'Edge'
        : /Chrome\//i.test(value)
            ? 'Chrome'
            : /Firefox\//i.test(value)
                ? 'Firefox'
                : /Safari\//i.test(value)
                    ? 'Safari'
                    : 'unknown'

    return { os, browser }
}

function sanitizeForAudit(value: any, depth = 0): any {
    if (value === null || value === undefined) return value
    if (depth > 5) return '[REDACTED:DEPTH]'

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeForAudit(item, depth + 1))
    }

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [
                key,
                SENSITIVE_KEY_PATTERN.test(key) ? '[REDACTED]' : sanitizeForAudit(nested, depth + 1),
            ])
        )
    }

    return value
}

export async function logAuditEvent(params: {
    supabase?: SupabaseClient
    request?: Request
    userId?: string | null
    organizationId?: string | null
    action: string
    category: AuditCategory
    table?: string | null
    recordId?: string | null
    oldData?: any
    newData?: any
    metadata?: Record<string, any>
    success?: boolean
    severity?: AuditSeverity
}) {
    const context = getAuditRequestContext(params.request)
    const success = params.success ?? true
    const severity = params.severity || (success ? 'info' : 'warn')
    const auditClient = params.supabase || createSupabaseServiceClient()

    const payload = {
        organization_id: params.organizationId || null,
        usuario_id: params.userId || null,
        accion: params.action,
        tabla: params.table || null,
        registro_id: toAuditUuid(params.recordId),
        datos_anteriores: sanitizeForAudit(params.oldData),
        datos_nuevos: sanitizeForAudit({
            ...(params.newData && typeof params.newData === 'object' && !Array.isArray(params.newData) ? params.newData : { value: params.newData }),
            audit: {
                category: params.category,
                success,
                severity,
                request_id: context.requestId,
                device: context.device,
                metadata: sanitizeForAudit(params.metadata || {}),
            },
        }),
        ip_address: context.ipAddress,
        user_agent: context.userAgent,
        event_category: params.category,
        severity,
        success,
        request_id: context.requestId,
    }

    try {
        const { error } = await auditClient.from('auditoria').insert(payload as any)
        if (error) {
            logger.error('Error logging audit event', error, { action: params.action, category: params.category })
        }
    } catch (err) {
        logger.error('Failed to log audit event', err, { action: params.action, category: params.category })
    }
}

export async function logAuthAudit(params: {
    request: Request
    action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGIN_BLOCKED' | 'LOGOUT'
    userId?: string | null
    organizationId?: string | null
    email?: string | null
    success: boolean
    reason?: string
}) {
    await logAuditEvent({
        request: params.request,
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        category: 'auth',
        table: 'auth',
        metadata: {
            email: params.email,
            reason: params.reason,
        },
        success: params.success,
        severity: params.success ? 'info' : 'warn',
    })
}

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
    await logAuditEvent({
        supabase: params.supabase,
        request: params.request,
        userId: params.userId,
        organizationId: params.organizationId,
        action: params.action,
        category: params.action.startsWith('DELETE') || params.action.startsWith('UPDATE') ? 'data' : 'system',
        table: params.table,
        recordId: params.recordId,
        oldData: params.oldData,
        newData: params.newData,
        success: true,
    })
}
