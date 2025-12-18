/**
 * Rate Limiting específico para autenticación usando Redis
 * Protege contra ataques de fuerza bruta
 *
 * MEJORA CRÍTICA: Ahora usa Redis en lugar de Map en memoria
 * Resuelve: AUTH-001 del reporte forense
 */

import { getRedisClient } from './redis'
import { logger } from './logger'

interface AuthAttempt {
    count: number
    firstAttempt: number
    lockedUntil: number | null
}

// Fallback: Store de intentos de login en memoria (solo si Redis falla)
const loginAttemptsMemory = new Map<string, AuthAttempt>()

// Configuración
const AUTH_RATE_LIMIT = {
    maxAttempts: 5,           // Máximo intentos antes de bloqueo
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    lockoutMs: 30 * 60 * 1000, // Bloqueo de 30 minutos
    cleanupIntervalMs: 5 * 60 * 1000 // Limpieza cada 5 minutos
}

// Prefijos para claves de Redis
const REDIS_PREFIX = 'auth:ratelimit:'
const REDIS_TTL = Math.ceil(AUTH_RATE_LIMIT.lockoutMs / 1000) + 60 // TTL extra de 1 min

/**
 * Obtiene el intento de login desde Redis o memoria
 */
async function getAttempt(identifier: string): Promise<AuthAttempt | null> {
    const redis = getRedisClient()

    if (redis) {
        try {
            const key = `${REDIS_PREFIX}${identifier}`
            const data = await redis.get(key)

            if (data) {
                return JSON.parse(data) as AuthAttempt
            }
            return null
        } catch (error) {
            logger.error('Error obteniendo attempt de Redis', error, { identifier })
            // Fallback a memoria
            return loginAttemptsMemory.get(identifier) || null
        }
    }

    // Fallback: usar memoria
    return loginAttemptsMemory.get(identifier) || null
}

/**
 * Guarda el intento de login en Redis o memoria
 */
async function setAttempt(identifier: string, attempt: AuthAttempt): Promise<void> {
    const redis = getRedisClient()

    if (redis) {
        try {
            const key = `${REDIS_PREFIX}${identifier}`
            await redis.set(
                key,
                JSON.stringify(attempt),
                'EX',
                REDIS_TTL
            )
            return
        } catch (error) {
            logger.error('Error guardando attempt en Redis', error, { identifier })
            // Fallback a memoria
        }
    }

    // Fallback: usar memoria
    loginAttemptsMemory.set(identifier, attempt)
}

/**
 * Elimina el intento de login de Redis o memoria
 */
async function deleteAttempt(identifier: string): Promise<void> {
    const redis = getRedisClient()

    if (redis) {
        try {
            const key = `${REDIS_PREFIX}${identifier}`
            await redis.del(key)
            return
        } catch (error) {
            logger.error('Error eliminando attempt de Redis', error, { identifier })
            // Fallback a memoria
        }
    }

    // Fallback: usar memoria
    loginAttemptsMemory.delete(identifier)
}

/**
 * Verifica si un identificador está bloqueado
 */
export async function isLoginBlocked(identifier: string): Promise<{
    blocked: boolean
    remainingAttempts: number
    lockoutEndsAt: number | null
    message: string
}> {
    const attempt = await getAttempt(identifier)
    const now = Date.now()

    if (!attempt) {
        return {
            blocked: false,
            remainingAttempts: AUTH_RATE_LIMIT.maxAttempts,
            lockoutEndsAt: null,
            message: ''
        }
    }

    // Verificar si está bloqueado
    if (attempt.lockedUntil && now < attempt.lockedUntil) {
        const remainingMinutes = Math.ceil((attempt.lockedUntil - now) / 60000)
        return {
            blocked: true,
            remainingAttempts: 0,
            lockoutEndsAt: attempt.lockedUntil,
            message: `Demasiados intentos fallidos. Intenta de nuevo en ${remainingMinutes} minutos.`
        }
    }

    // Verificar si la ventana expiró
    if (now - attempt.firstAttempt > AUTH_RATE_LIMIT.windowMs) {
        await deleteAttempt(identifier)
        return {
            blocked: false,
            remainingAttempts: AUTH_RATE_LIMIT.maxAttempts,
            lockoutEndsAt: null,
            message: ''
        }
    }

    const remaining = AUTH_RATE_LIMIT.maxAttempts - attempt.count
    return {
        blocked: remaining <= 0,
        remainingAttempts: Math.max(0, remaining),
        lockoutEndsAt: attempt.lockedUntil,
        message: remaining <= 2 ? `Te quedan ${remaining} intentos` : ''
    }
}

/**
 * Registra un intento de login fallido
 */
export async function recordFailedLogin(identifier: string): Promise<void> {
    const now = Date.now()
    const attempt = await getAttempt(identifier)

    if (!attempt || now - attempt.firstAttempt > AUTH_RATE_LIMIT.windowMs) {
        // Nueva ventana
        await setAttempt(identifier, {
            count: 1,
            firstAttempt: now,
            lockedUntil: null
        })
        return
    }

    // Incrementar contador
    attempt.count++

    // Bloquear si excede límite
    if (attempt.count >= AUTH_RATE_LIMIT.maxAttempts) {
        attempt.lockedUntil = now + AUTH_RATE_LIMIT.lockoutMs
    }

    await setAttempt(identifier, attempt)
}

/**
 * Limpia el registro de intentos después de login exitoso
 */
export async function clearLoginAttempts(identifier: string): Promise<void> {
    await deleteAttempt(identifier)
}

/**
 * Obtiene el identificador para rate limiting
 * Usa email + IP para mayor seguridad
 */
export function getLoginIdentifier(email: string, ip: string): string {
    // Normalizar email
    const normalizedEmail = email.toLowerCase().trim()
    return `${normalizedEmail}:${ip}`
}

/**
 * Limpieza periódica de entradas expiradas en memoria
 * (Redis ya tiene TTL automático)
 */
function cleanupExpiredAttempts(): void {
    const redis = getRedisClient()

    // Si hay Redis, no necesitamos limpiar memoria (Redis tiene TTL)
    if (redis) return

    // Solo limpiar memoria si estamos en fallback mode
    const now = Date.now()
    for (const [key, attempt] of loginAttemptsMemory.entries()) {
        // Eliminar si la ventana expiró y no está bloqueado
        if (now - attempt.firstAttempt > AUTH_RATE_LIMIT.windowMs) {
            if (!attempt.lockedUntil || now > attempt.lockedUntil) {
                loginAttemptsMemory.delete(key)
            }
        }
    }
}

// Ejecutar limpieza periódica (solo para fallback en memoria)
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupExpiredAttempts, AUTH_RATE_LIMIT.cleanupIntervalMs)
}

/**
 * Middleware helper para verificar rate limit en login
 */
export async function checkAuthRateLimit(email: string, ip: string): Promise<{
    allowed: boolean
    error?: string
    remainingAttempts?: number
}> {
    const identifier = getLoginIdentifier(email, ip)
    const status = await isLoginBlocked(identifier)

    if (status.blocked) {
        return {
            allowed: false,
            error: status.message,
            remainingAttempts: 0
        }
    }

    return {
        allowed: true,
        remainingAttempts: status.remainingAttempts
    }
}
