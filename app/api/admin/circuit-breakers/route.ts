/**
 * API: Admin - Circuit Breakers Stats
 *
 * GET /api/admin/circuit-breakers
 * Retorna estadísticas de todos los circuit breakers activos
 *
 * POST /api/admin/circuit-breakers
 * Reinicia un circuit breaker específico con body { name }
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllCircuitBreakersStats,
  resetCircuitBreaker,
} from '@/lib/circuit-breaker'
import { requirePlatformAdmin } from '@/lib/auth-helpers'
import { createRequestLogger } from '@/lib/logger'
import { getHttpStatusForError, sanitizeErrorForClient } from '@/lib/error-handler'

/**
 * GET - Obtener estadísticas de circuit breakers
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    await requirePlatformAdmin()

    const stats = getAllCircuitBreakersStats()

    return NextResponse.json({
      success: true,
      data: {
        circuitBreakers: stats,
        totalCircuitBreakers: stats.length,
        openCircuitBreakers: stats.filter((s) => s.state === 'OPEN').length,
        summary: {
          totalRequests: stats.reduce((sum, s) => sum + s.totalRequests, 0),
          totalFailures: stats.reduce((sum, s) => sum + s.failedRequests, 0),
          avgErrorRate:
            stats.length > 0
              ? stats.reduce((sum, s) => sum + s.errorRate, 0) / stats.length
              : 0,
        },
      },
    })
  } catch (error: any) {
    log.error('Error obteniendo stats de circuit breakers', error)

    return NextResponse.json(
      {
        success: false,
        error: getHttpStatusForError(error) === 500 ? 'Error al obtener estadísticas' : sanitizeErrorForClient(error),
      },
      { status: getHttpStatusForError(error) }
    )
  }
}

/**
 * POST - Reiniciar circuit breaker
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    await requirePlatformAdmin()

    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_IN_MEMORY_ADMIN_MUTATIONS !== 'true') {
      return NextResponse.json(
        {
          success: false,
          error: 'Los circuit breakers en memoria no se pueden reiniciar en producción. Configura almacenamiento persistente para este control.',
        },
        { status: 501 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Falta parámetro: name' },
        { status: 400 }
      )
    }

    resetCircuitBreaker(name)

    return NextResponse.json({
      success: true,
      message: `Circuit breaker ${name} reiniciado correctamente`,
    })
  } catch (error: any) {
    log.error('Error reiniciando circuit breaker', error)

    return NextResponse.json(
      {
        success: false,
        error: getHttpStatusForError(error) === 500 ? 'Error al reiniciar circuit breaker' : sanitizeErrorForClient(error),
      },
      { status: getHttpStatusForError(error) }
    )
  }
}
