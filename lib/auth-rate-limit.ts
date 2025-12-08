/**
 * Rate Limiting específico para autenticación
 * Protege contra ataques de fuerza bruta
 */

interface AuthAttempt {
    count: number
    firstAttempt: number
    lockedUntil: number | null
}

// Store de intentos de login (en producción usar Redis)
const loginAttempts = new Map<string, AuthAttempt>()

// Configuración
const AUTH_RATE_LIMIT = {
    maxAttempts: 5,           // Máximo intentos antes de bloqueo
    windowMs: 15 * 60 * 1000, // Ventana de 15 minutos
    lockoutMs: 30 * 60 * 1000, // Bloqueo de 30 minutos
    cleanupIntervalMs: 5 * 60 * 1000 // Limpieza cada 5 minutos
}

/**
 * Verifica si un identificador está bloqueado
 */
export function isLoginBlocked(identifier: string): {
    blocked: boolean
    remainingAttempts: number
    lockoutEndsAt: number | null
    message: string
} {
    const attempt = loginAttempts.get(identifier)
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
        loginAttempts.delete(identifier)
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
export function recordFailedLogin(identifier: string): void {
    const now = Date.now()
    const attempt = loginAttempts.get(identifier)

    if (!attempt || now - attempt.firstAttempt > AUTH_RATE_LIMIT.windowMs) {
        // Nueva ventana
        loginAttempts.set(identifier, {
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

    loginAttempts.set(identifier, attempt)
}

/**
 * Limpia el registro de intentos después de login exitoso
 */
export function clearLoginAttempts(identifier: string): void {
    loginAttempts.delete(identifier)
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
 * Limpieza periódica de entradas expiradas
 */
function cleanupExpiredAttempts(): void {
    const now = Date.now()
    for (const [key, attempt] of loginAttempts.entries()) {
        // Eliminar si la ventana expiró y no está bloqueado
        if (now - attempt.firstAttempt > AUTH_RATE_LIMIT.windowMs) {
            if (!attempt.lockedUntil || now > attempt.lockedUntil) {
                loginAttempts.delete(key)
            }
        }
    }
}

// Ejecutar limpieza periódica
if (typeof setInterval !== 'undefined') {
    setInterval(cleanupExpiredAttempts, AUTH_RATE_LIMIT.cleanupIntervalMs)
}

/**
 * Middleware helper para verificar rate limit en login
 */
export function checkAuthRateLimit(email: string, ip: string): {
    allowed: boolean
    error?: string
    remainingAttempts?: number
} {
    const identifier = getLoginIdentifier(email, ip)
    const status = isLoginBlocked(identifier)

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
