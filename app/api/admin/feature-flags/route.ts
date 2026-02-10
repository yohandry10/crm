/**
 * API: Admin - Feature Flags
 *
 * GET /api/admin/feature-flags
 * Retorna todos los feature flags y su estado
 *
 * POST /api/admin/feature-flags/toggle
 * Activa/desactiva un feature flag
 *
 * POST /api/admin/feature-flags/kill-switch
 * Activa un kill switch de emergencia
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAllFeatureFlags,
  activateKillSwitch,
  deactivateKillSwitch,
  getFeatureFlag,
  FEATURE_FLAGS,
} from '@/lib/feature-flags'
import { requirePlatformAdmin } from '@/lib/auth-helpers'
import { createRequestLogger } from '@/lib/logger'

/**
 * GET - Obtener todos los feature flags
 */
export async function GET(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    await requirePlatformAdmin()

    const flags = getAllFeatureFlags()

    // Calcular estadísticas
    const stats = {
      total: Object.keys(flags).length,
      enabled: Object.values(flags).filter((f) => f.enabled).length,
      disabled: Object.values(flags).filter((f) => !f.enabled).length,
      killSwitches: Object.values(flags).filter((f) => f.killSwitch).length,
      planRestricted: Object.values(flags).filter(
        (f) => f.allowedPlans && f.allowedPlans.length > 0
      ).length,
    }

    return NextResponse.json({
      success: true,
      data: {
        flags,
        stats,
      },
    })
  } catch (error: any) {
    log.error('Error obteniendo feature flags', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener feature flags',
      },
      { status: 500 }
    )
  }
}

/**
 * POST - Toggle feature flag o kill switch
 */
export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)
  try {
    const { user } = await requirePlatformAdmin()

    const body = await request.json()
    const { action, flagKey } = body

    if (!action || !flagKey) {
      return NextResponse.json(
        { success: false, error: 'Faltan parámetros: action, flagKey' },
        { status: 400 }
      )
    }

    const flag = getFeatureFlag(flagKey)
    if (!flag) {
      return NextResponse.json(
        { success: false, error: `Feature flag no encontrado: ${flagKey}` },
        { status: 404 }
      )
    }

    switch (action) {
      case 'toggle':
        // Toggle enabled/disabled
        FEATURE_FLAGS[flagKey].enabled = !FEATURE_FLAGS[flagKey].enabled
        log.info('Feature flag toggled', { flagKey, enabled: FEATURE_FLAGS[flagKey].enabled, userId: user.id })
        break

      case 'activate_kill_switch':
        activateKillSwitch(flagKey)
        log.warn('Kill switch activated', { flagKey, userId: user.id })
        break

      case 'deactivate_kill_switch':
        deactivateKillSwitch(flagKey)
        log.info('Kill switch deactivated', { flagKey, userId: user.id })
        break

      default:
        return NextResponse.json(
          { success: false, error: `Acción no válida: ${action}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message: `Feature flag ${flagKey} actualizado`,
      flag: getFeatureFlag(flagKey),
    })
  } catch (error: any) {
    log.error('Error actualizando feature flag', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Error al actualizar feature flag',
      },
      { status: 500 }
    )
  }
}
