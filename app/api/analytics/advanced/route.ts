/**
 * API: Advanced Analytics (Feature Flag Protected)
 *
 * GET /api/analytics/advanced
 * Retorna analytics avanzado (solo para usuarios Pro/Enterprise)
 *
 * Este endpoint está protegido por feature flag
 */

import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedContext } from '@/lib/supabase-auth'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    // Autenticación
    const { user, organizationId } = await getAuthenticatedContext()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    // Verificar feature flag
    // TODO: Obtener el plan del usuario de la base de datos
    const userPlan = 'pro' // Hardcoded por ahora

    const hasAccess = isFeatureEnabled('advanced_analytics', {
      userId: user.id,
      organizationId,
      userPlan,
    })

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: 'Feature not available',
          message:
            'Advanced analytics is only available for Pro and Enterprise plans.',
          upgradeUrl: '/settings/billing',
        },
        { status: 403 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Advanced analytics is not implemented',
        message: 'Este modulo no devuelve datos ficticios. Debe conectarse a métricas reales antes de habilitarse.',
      },
      { status: 501 }
    )
  } catch (error: any) {
    log.error('Error en analytics avanzado', error)

    return NextResponse.json(
      {
        success: false,
        error: sanitizeErrorForClient(error),
      },
      { status: getHttpStatusForError(error) }
    )
  }
}
