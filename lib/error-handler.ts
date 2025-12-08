/**
 * Error Handler - Sanitización y clasificación de errores
 * Resuelve: Exposición de información sensible en mensajes de error
 */

// Tipos de error personalizados
export class ValidationError extends Error {
    constructor(message: string, public details?: any) {
        super(message)
        this.name = 'ValidationError'
    }
}

export class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
        super(id ? `${resource} con id ${id} no encontrado` : `${resource} no encontrado`)
        this.name = 'NotFoundError'
    }
}

export class UnauthorizedError extends Error {
    constructor(message: string = 'No autorizado') {
        super(message)
        this.name = 'UnauthorizedError'
    }
}

export class ForbiddenError extends Error {
    constructor(message: string = 'No tienes permisos para esta acción') {
        super(message)
        this.name = 'ForbiddenError'
    }
}

export class ConflictError extends Error {
    constructor(message: string = 'El recurso ya existe') {
        super(message)
        this.name = 'ConflictError'
    }
}

export class BusinessRuleError extends Error {
    constructor(message: string) {
        super(message)
        this.name = 'BusinessRuleError'
    }
}

// Mapeo de códigos de error de PostgreSQL/Supabase a mensajes seguros
const SAFE_ERROR_MESSAGES: Record<string, string> = {
    // PostgreSQL error codes
    'PGRST116': 'Recurso no encontrado',
    'PGRST301': 'Error de conexión a la base de datos',
    '23505': 'Este registro ya existe',
    '23503': 'No se puede completar la operación, existen registros relacionados',
    '23502': 'Faltan campos requeridos',
    '42501': 'No tienes permisos para esta acción',
    '42P01': 'Error interno del sistema',
    '22P02': 'Formato de datos inválido',
    '22003': 'Valor numérico fuera de rango',
    
    // Supabase Auth errors
    'invalid_credentials': 'Credenciales inválidas',
    'email_not_confirmed': 'Por favor confirma tu email antes de iniciar sesión',
    'user_not_found': 'Usuario no encontrado',
    'invalid_grant': 'Sesión expirada, por favor inicia sesión nuevamente',
    
    // Custom application errors
    'STOCK_INSUFFICIENT': 'Stock insuficiente para completar la operación',
    'PAYMENT_EXCEEDS_TOTAL': 'El monto del pago excede el total de la factura',
    'WORKFLOW_INACTIVE': 'El workflow no está activo',
    'WORKFLOW_LOOP_DETECTED': 'Se detectó un posible loop en la ejecución del workflow'
}

// Patrones de error que contienen información sensible
const SENSITIVE_PATTERNS = [
    /column "[\w_]+" of relation/i,
    /relation "[\w_]+" does not exist/i,
    /duplicate key value violates unique constraint/i,
    /violates foreign key constraint/i,
    /permission denied for/i,
    /syntax error at or near/i,
    /invalid input syntax/i
]

/**
 * Sanitiza un mensaje de error para enviar al cliente
 * Oculta información sensible en producción
 */
export function sanitizeErrorForClient(error: any): string {
    // Si es un error personalizado, usar su mensaje
    if (error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof UnauthorizedError ||
        error instanceof ForbiddenError ||
        error instanceof ConflictError ||
        error instanceof BusinessRuleError) {
        return error.message
    }

    // Buscar código de error conocido
    const errorCode = error.code || error.error?.code
    if (errorCode && SAFE_ERROR_MESSAGES[errorCode]) {
        return SAFE_ERROR_MESSAGES[errorCode]
    }

    // En desarrollo, mostrar mensaje original
    if (process.env.NODE_ENV === 'development') {
        return error.message || 'Error desconocido'
    }

    // En producción, verificar si el mensaje contiene información sensible
    const message = error.message || ''
    for (const pattern of SENSITIVE_PATTERNS) {
        if (pattern.test(message)) {
            return 'Ha ocurrido un error al procesar tu solicitud. Por favor intenta de nuevo.'
        }
    }

    // Si el mensaje parece seguro y es corto, usarlo
    if (message.length < 100 && !message.includes('sql') && !message.includes('query')) {
        return message
    }

    // Mensaje genérico por defecto
    return 'Ha ocurrido un error. Por favor intenta de nuevo o contacta soporte.'
}

/**
 * Obtiene el código de estado HTTP apropiado para un error
 */
export function getHttpStatusForError(error: any): number {
    if (error instanceof ValidationError) return 400
    if (error instanceof NotFoundError) return 404
    if (error instanceof UnauthorizedError) return 401
    if (error instanceof ForbiddenError) return 403
    if (error instanceof ConflictError) return 409
    if (error instanceof BusinessRuleError) return 422

    // Códigos de PostgreSQL
    const errorCode = error.code || error.error?.code
    switch (errorCode) {
        case 'PGRST116': return 404
        case '23505': return 409
        case '23503': return 409
        case '42501': return 403
        case '22P02':
        case '22003':
        case '23502': return 400
        default: return 500
    }
}

/**
 * Formatea un error para respuesta de API
 */
export function formatApiError(error: any): {
    success: false
    error: string
    code?: string
    details?: any
} {
    const response: any = {
        success: false,
        error: sanitizeErrorForClient(error)
    }

    // Incluir código si es seguro
    if (error.code && !error.code.includes('PG')) {
        response.code = error.code
    }

    // Incluir detalles de validación si es ValidationError
    if (error instanceof ValidationError && error.details) {
        response.details = error.details
    }

    return response
}

/**
 * Helper para crear respuestas de error consistentes
 */
export function createErrorResponse(error: any) {
    const { NextResponse } = require('next/server')
    return NextResponse.json(
        formatApiError(error),
        { status: getHttpStatusForError(error) }
    )
}
