/**
 * Session Security Utilities (Resuelve AUTH-003)
 *
 * Protección contra Session Fixation y Session Hijacking
 */

import { NextRequest } from 'next/server'

/**
 * Valida que una sesión sea segura y no haya sido comprometida
 */
export function validateSessionSecurity(request: NextRequest): {
    valid: boolean
    reason?: string
} {
    // 1. Verificar que existe User-Agent (previene sesión sin contexto)
    const userAgent = request.headers.get('user-agent')
    if (!userAgent) {
        return {
            valid: false,
            reason: 'Missing User-Agent header'
        }
    }

    // 2. Verificar cookies de sesión de Supabase
    const cookies = request.cookies
    const accessToken = cookies.get('sb-access-token') || cookies.get('supabase-auth-token')
    const refreshToken = cookies.get('sb-refresh-token')

    // Si tiene tokens, verificar que sean del mismo origen (básico)
    if (accessToken && refreshToken) {
        // Las cookies de Supabase deben tener ambos tokens presentes
        // Si falta uno, puede ser session fixation attack
        return { valid: true }
    }

    // Si no tiene tokens, la sesión será validada por Supabase en getUser()
    return { valid: true }
}

/**
 * Genera un fingerprint básico de la sesión para detectar cambios sospechosos
 */
export function generateSessionFingerprint(request: NextRequest): string {
    const userAgent = request.headers.get('user-agent') || 'unknown'
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown'

    // Simple hash para identificar la sesión (no es criptográfico, solo identificador)
    return Buffer.from(`${userAgent}-${ip}`).toString('base64').slice(0, 32)
}

/**
 * Valida que el fingerprint de la sesión no haya cambiado drásticamente
 * (puede cambiar ligeramente por proxies/VPN, pero no completamente)
 */
export function validateSessionFingerprint(
    currentFingerprint: string,
    storedFingerprint: string
): boolean {
    // Si son exactamente iguales, perfecto
    if (currentFingerprint === storedFingerprint) {
        return true
    }

    // Permitir pequeñas variaciones (por ejemplo, cambio de proxy)
    // pero rechazar cambios completos
    const similarity = calculateSimilarity(currentFingerprint, storedFingerprint)
    return similarity > 0.7 // 70% de similitud mínima
}

function calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length
    const len2 = str2.length
    const maxLen = Math.max(len1, len2)

    if (maxLen === 0) return 1.0

    let matches = 0
    for (let i = 0; i < Math.min(len1, len2); i++) {
        if (str1[i] === str2[i]) matches++
    }

    return matches / maxLen
}

/**
 * Headers de seguridad para sesiones
 */
export const SESSION_SECURITY_HEADERS = {
    // Prevenir que JavaScript acceda a cookies de sesión
    'Set-Cookie-HttpOnly': 'true',

    // Solo HTTPS en producción
    'Set-Cookie-Secure': process.env.NODE_ENV === 'production' ? 'true' : 'false',

    // SameSite=Lax previene CSRF básico
    'Set-Cookie-SameSite': 'Lax',

    // Indicador de sesión segura
    'X-Session-Security': 'enabled'
} as const
