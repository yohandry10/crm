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
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    // Autenticación
    const { user, organizationId, supabase } = await getAuthenticatedContext()

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

    // Lógica de analytics avanzado
    // TODO: Implementar queries de analytics

    const analyticsData = {
      revenue: {
        total: 125000,
        growth: 15.3,
        forecast: 145000,
      },
      customers: {
        total: 458,
        new: 34,
        churnRate: 2.1,
      },
      topProducts: [
        { name: 'Product A', revenue: 45000, units: 120 },
        { name: 'Product B', revenue: 32000, units: 89 },
        { name: 'Product C', revenue: 28000, units: 75 },
      ],
      cohortAnalysis: {
        // Datos de cohort analysis...
      },
    }

    const response = NextResponse.json({
      success: true,
      data: analyticsData,
    })

    // ✅ SECURITY: Prevent cache leaks between organizations
    // Cache for 5 minutes (private data)
    response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=60')

    // Vary header ensures different cache entries for different auth contexts
    response.headers.set('Vary', 'Authorization, Cookie, X-Organization-ID')

    // Unique cache key per organization to prevent cross-org data leaks
    const cacheKey = crypto.createHash('sha256')
      .update(`analytics-advanced:${organizationId}:${new Date().toISOString().split('T')[0]}`)
      .digest('hex')
    response.headers.set('X-Cache-Key', cacheKey)

    return response
  } catch (error: any) {
    log.error('Error en analytics avanzado', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener analytics',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
