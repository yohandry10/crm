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
import { isFeatureEnabled, type FeatureFlagContext } from '@/lib/feature-flags'
import { rateLimit, RATE_LIMITS } from '@/lib/rate-limit'
import { createRequestLogger } from '@/lib/logger'
import { sanitizeErrorForClient, getHttpStatusForError } from '@/lib/error-handler'

type FeaturePlan = NonNullable<FeatureFlagContext['userPlan']>

function mapSubscriptionToFeaturePlan(
  subscriptionPlan?: string | null,
  subscriptionStatus?: string | null
): FeaturePlan {
  if (subscriptionStatus !== 'active') return 'free'

  switch ((subscriptionPlan || '').toLowerCase()) {
    case 'enterprise':
      return 'enterprise'
    case 'professional':
    case 'pro':
      return 'pro'
    default:
      return 'free'
  }
}

export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const rateLimitResponse = await rateLimit(request, RATE_LIMITS.read)
    if (rateLimitResponse) return rateLimitResponse

    // Autenticación
    const { supabase, user, organizationId } = await getAuthenticatedContext()

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'No autenticado' },
        { status: 401 }
      )
    }

    const { data: organization, error: organizationError } = await supabase
      .from('organizations')
      .select('subscription_plan, subscription_status')
      .eq('id', organizationId)
      .single()

    if (organizationError || !organization) {
      throw organizationError || new Error('Organization not found')
    }

    const userPlan = mapSubscriptionToFeaturePlan(
      organization.subscription_plan,
      organization.subscription_status
    )

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
