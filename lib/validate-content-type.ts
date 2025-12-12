/**
 * Validación de Content-Type (Resuelve SEC-002)
 *
 * Previene ataques que explotan Content-Type incorrectos:
 * - Content-Type confusion attacks
 * - Type juggling
 * - MIME sniffing attacks
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Valida que el Content-Type sea application/json para requests POST/PUT/PATCH
 *
 * @param request - Next.js request object
 * @returns NextResponse con error 415 si el Content-Type es inválido, null si es válido
 */
export function validateJsonContentType(request: NextRequest): NextResponse | null {
    const method = request.method
    const contentType = request.headers.get('content-type')

    // Solo validar en métodos que envían body
    if (!['POST', 'PUT', 'PATCH'].includes(method)) {
        return null // GET, DELETE, etc. no requieren Content-Type
    }

    // Si no tiene Content-Type, rechazar
    if (!contentType) {
        return NextResponse.json(
            {
                success: false,
                error: 'Content-Type header is required',
                details: 'Expected: application/json'
            },
            { status: 415 } // 415 Unsupported Media Type
        )
    }

    // Validar que sea application/json
    // Permitir charset y otros parámetros: application/json; charset=utf-8
    if (!contentType.toLowerCase().includes('application/json')) {
        return NextResponse.json(
            {
                success: false,
                error: 'Invalid Content-Type',
                details: `Expected application/json, received: ${contentType}`
            },
            { status: 415 }
        )
    }

    return null // Válido
}

/**
 * Valida Content-Type multipart/form-data (para uploads)
 */
export function validateFormDataContentType(request: NextRequest): NextResponse | null {
    const contentType = request.headers.get('content-type')

    if (!contentType || !contentType.toLowerCase().includes('multipart/form-data')) {
        return NextResponse.json(
            {
                success: false,
                error: 'Invalid Content-Type',
                details: `Expected multipart/form-data, received: ${contentType || 'none'}`
            },
            { status: 415 }
        )
    }

    return null
}

/**
 * Valida Content-Type application/x-www-form-urlencoded
 */
export function validateUrlEncodedContentType(request: NextRequest): NextResponse | null {
    const contentType = request.headers.get('content-type')

    if (!contentType || !contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
        return NextResponse.json(
            {
                success: false,
                error: 'Invalid Content-Type',
                details: `Expected application/x-www-form-urlencoded, received: ${contentType || 'none'}`
            },
            { status: 415 }
        )
    }

    return null
}
