import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import type { OrgRole } from '@/lib/types/organization'
import { logger } from './logger'
import { getRedisClient } from './redis'
import { ForbiddenError } from '@/lib/error-handler'

type CachedAuthContext = {
    organizationId: string
    organization: any
    membership: any
    role: OrgRole
}

const AUTH_CONTEXT_TTL_SECONDS = 60
const authContextMemoryCache = new Map<string, { data: CachedAuthContext; expiresAt: number }>()

function getAuthContextCacheKey(userId: string, organizationId?: string) {
    return organizationId ? `authctx:${userId}:${organizationId}` : `authctx:${userId}`
}

async function getCachedAuthContext(userId: string, organizationId?: string) {
    const redis = getRedisClient()
    const key = getAuthContextCacheKey(userId, organizationId)
    const fallbackKey = getAuthContextCacheKey(userId)

    if (redis) {
        try {
            const cached = await redis.get(key) || (!organizationId ? null : await redis.get(fallbackKey))
            if (cached) {
                try {
                    const data = JSON.parse(cached) as CachedAuthContext
                    if (organizationId && data.organizationId !== organizationId) {
                        return null
                    }
                    return data
                } catch {
                    return null
                }
            }
        } catch {
            // Ignore cache errors
        }
    }

    const entry = authContextMemoryCache.get(key) || (!organizationId ? undefined : authContextMemoryCache.get(fallbackKey))
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        authContextMemoryCache.delete(key)
        authContextMemoryCache.delete(fallbackKey)
        return null
    }
    if (organizationId && entry.data.organizationId !== organizationId) {
        return null
    }
    return entry.data
}

async function setCachedAuthContext(userId: string, data: CachedAuthContext, options: { cacheAsDefault?: boolean } = {}) {
    const cacheAsDefault = options.cacheAsDefault !== false
    const redis = getRedisClient()
    const key = getAuthContextCacheKey(userId, data.organizationId)
    const fallbackKey = getAuthContextCacheKey(userId)
    const payload = JSON.stringify(data)

    if (redis) {
        try {
            await redis.set(key, payload, 'EX', AUTH_CONTEXT_TTL_SECONDS)
            if (cacheAsDefault) {
                await redis.set(fallbackKey, payload, 'EX', AUTH_CONTEXT_TTL_SECONDS)
            }
        } catch {
            // Ignore cache errors
        }
    }

    const expiresAt = Date.now() + AUTH_CONTEXT_TTL_SECONDS * 1000
    authContextMemoryCache.set(key, { data, expiresAt })
    if (cacheAsDefault) {
        authContextMemoryCache.set(fallbackKey, { data, expiresAt })
    }
}

/**
 * Crea cliente de Supabase para rutas de API usando SSR
 */
export async function createSupabaseRouteClient() {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)')
    }

    const cookieStore = await cookies()

    return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                } catch {
                    // Ignorar errores en contextos de solo lectura
                }
            },
        },
    })
}

/**
 * Crea cliente autenticado usando SSR
 */
export async function createAuthenticatedClient() {
    const supabase = await createSupabaseRouteClient()
    return { supabase }
}

/**
 * Requiere autenticación
 */
export async function requireAuth() {
    const supabase = await createSupabaseRouteClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) throw new Error('Unauthorized')
    return user
}

/**
 * Obtiene cliente autenticado y usuario
 */
export async function getAuthenticatedClientAndUser() {
    const supabase = await createSupabaseRouteClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) throw new Error('Unauthorized')
    return { supabase, user }
}

/**
 * MULTI-TENANT: Obtiene cliente, usuario y organización actual
 */
export async function getAuthenticatedContext() {
    try {
        const { supabase, user } = await getAuthenticatedClientAndUser()
        const headersList = await headers()
        const orgHint = headersList.get('x-organization-id')?.trim() || undefined

        const cached = await getCachedAuthContext(user.id, orgHint)
        if (cached) {
            return {
                supabase,
                user,
                organizationId: cached.organizationId,
                organization: cached.organization,
                membership: cached.membership,
                role: cached.role,
            }
        }

        // Get organization from header or profile
        let orgId = orgHint

        if (!orgId) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('current_organization_id')
                .eq('id', user.id)
                .single()
            orgId = profile?.current_organization_id
        }

        if (!orgId) {
            // Get first organization
            const { data: membership } = await supabase
                .from('organization_members')
                .select('organization_id')
                .eq('user_id', user.id)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle()
            orgId = membership?.organization_id
        }

        if (!orgId) {
            throw new Error('No organization found. Please create or join an organization.')
        }

        // Verify membership
        const { data: membership, error: memError } = await supabase
            .from('organization_members')
            .select('*, organization:organizations(*)')
            .eq('organization_id', orgId)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .maybeSingle()

        if (memError || !membership) {
            throw new ForbiddenError('No perteneces a esta organización')
        }

        const orgIdValue = orgId as string
        const context = {
            organizationId: orgIdValue,
            organization: membership.organization,
            membership,
            role: membership.role as OrgRole,
        }
        await setCachedAuthContext(user.id, context, { cacheAsDefault: !orgHint })

        return {
            supabase,
            user,
            ...context,
        }
    } catch (error) {
        logger.error("Error in getAuthenticatedContext", error)
        throw error
    }
}

/**
 * MULTI-TENANT: Requiere rol específico en la organización
 */
export async function requireOrgRole(allowedRoles: OrgRole[]) {
    const ctx = await getAuthenticatedContext()

    if (!allowedRoles.includes(ctx.role)) {
        throw new Error(`Forbidden: Required roles: ${allowedRoles.join(', ')}`)
    }

    return ctx
}

/**
 * Wrapper para manejar errores de autenticación
 */
export function withAuth<T>(handler: () => Promise<T>, options?: { roles?: OrgRole[] }) {
    return async () => {
        try {
            if (options?.roles) {
                await requireOrgRole(options.roles)
            } else {
                await requireAuth()
            }
            return await handler()
        } catch (error: any) {
            if (error.message === 'Unauthorized') {
                return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 })
            }
            if (error.message.startsWith('Forbidden')) {
                return NextResponse.json({ success: false, error: 'Sin permisos' }, { status: 403 })
            }
            throw error
        }
    }
}
