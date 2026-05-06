/**
 * Feature Flags System
 *
 * Sistema de feature flags para control de features en producción
 *
 * Características:
 * - Flags por entorno (development, staging, production)
 * - Flags por usuario (A/B testing)
 * - Flags por organización (plan-based features)
 * - Rollout gradual (% de usuarios)
 * - Kill switch para features problemáticas
 *
 * Casos de uso:
 * - Desplegar features en dark launch
 * - A/B testing
 * - Plan-based features (free vs pro)
 * - Kill switch de emergencia
 * - Rollout gradual (1% → 10% → 50% → 100%)
 */

export type FeatureFlagEnvironment = 'development' | 'staging' | 'production'

export interface FeatureFlag {
  /**
   * Identificador único del flag
   */
  key: string

  /**
   * Nombre descriptivo
   */
  name: string

  /**
   * Descripción de qué hace el flag
   */
  description: string

  /**
   * Si está habilitado por defecto
   */
  enabled: boolean

  /**
   * Entornos donde está habilitado
   */
  environments?: FeatureFlagEnvironment[]

  /**
   * Porcentaje de rollout (0-100)
   * Si es 50, solo 50% de usuarios verán el feature
   */
  rolloutPercentage?: number

  /**
   * IDs de usuarios que tienen acceso (whitelist)
   */
  allowedUserIds?: string[]

  /**
   * IDs de organizaciones que tienen acceso
   */
  allowedOrganizationIds?: string[]

  /**
   * Planes que tienen acceso (free, pro, enterprise)
   */
  allowedPlans?: Array<'free' | 'pro' | 'enterprise'>

  /**
   * Fecha de inicio (antes de esta fecha, disabled)
   */
  startDate?: Date

  /**
   * Fecha de fin (después de esta fecha, disabled)
   */
  endDate?: Date

  /**
   * Si está en modo kill switch (fuerza disabled)
   */
  killSwitch?: boolean
}

export interface FeatureFlagContext {
  userId?: string
  organizationId?: string
  userPlan?: 'free' | 'pro' | 'enterprise'
  environment?: FeatureFlagEnvironment
}

/**
 * Definición de todos los feature flags
 *
 * IMPORTANTE: Agregar nuevos flags aquí
 */
export const FEATURE_FLAGS: Record<string, FeatureFlag> = {
  // ========================================
  // WORKFLOWS
  // ========================================

  workflow_ai_suggestions: {
    key: 'workflow_ai_suggestions',
    name: 'AI Workflow Suggestions',
    description: 'Sugerencias de workflows con IA',
    enabled: false,
    environments: ['development'],
    rolloutPercentage: 0, // 0% en producción (dark launch)
    allowedPlans: ['pro', 'enterprise'],
  },

  workflow_templates: {
    key: 'workflow_templates',
    name: 'Workflow Templates',
    description: 'Templates predefinidos de workflows',
    enabled: true,
    rolloutPercentage: 100,
  },

  workflow_scheduling: {
    key: 'workflow_scheduling',
    name: 'Scheduled Workflows',
    description: 'Ejecutar workflows en horario programado',
    enabled: true,
    environments: ['development', 'staging', 'production'],
    allowedPlans: ['pro', 'enterprise'],
  },

  // ========================================
  // ANALYTICS
  // ========================================

  advanced_analytics: {
    key: 'advanced_analytics',
    name: 'Advanced Analytics',
    description: 'Dashboard de analytics avanzado',
    enabled: true,
    allowedPlans: ['pro', 'enterprise'],
  },

  export_analytics: {
    key: 'export_analytics',
    name: 'Export Analytics',
    description: 'Exportar reportes de analytics',
    enabled: true,
    allowedPlans: ['pro', 'enterprise'],
  },

  // ========================================
  // IMPORTACIONES
  // ========================================

  bulk_import: {
    key: 'bulk_import',
    name: 'Bulk Import',
    description: 'Importar más de 1000 registros',
    enabled: true,
    allowedPlans: ['pro', 'enterprise'],
  },

  import_validation: {
    key: 'import_validation',
    name: 'Import Validation',
    description: 'Validación avanzada de datos en importaciones',
    enabled: true,
    rolloutPercentage: 50, // Rollout gradual 50%
  },

  // ========================================
  // INTEGRACIONES
  // ========================================

  integrations_zapier: {
    key: 'integrations_zapier',
    name: 'Zapier Integration',
    description: 'Integración con Zapier',
    enabled: false,
    environments: ['development'],
    rolloutPercentage: 0,
  },

  integrations_slack: {
    key: 'integrations_slack',
    name: 'Slack Integration',
    description: 'Notificaciones a Slack',
    enabled: true,
    allowedPlans: ['pro', 'enterprise'],
  },

  // ========================================
  // EXPERIMENTAL
  // ========================================

  dark_mode: {
    key: 'dark_mode',
    name: 'Dark Mode',
    description: 'Tema oscuro en la UI',
    enabled: false,
    rolloutPercentage: 10, // Rollout gradual 10%
  },

  new_dashboard: {
    key: 'new_dashboard',
    name: 'New Dashboard Design',
    description: 'Nuevo diseño del dashboard',
    enabled: false,
    environments: ['development'],
    rolloutPercentage: 0,
  },

  // ========================================
  // KILL SWITCHES (para emergencias)
  // ========================================

  email_sending: {
    key: 'email_sending',
    name: 'Email Sending',
    description: 'Envío de emails (kill switch de emergencia)',
    enabled: true,
    killSwitch: false, // Cambiar a true para deshabilitar todos los emails
  },

  webhook_sending: {
    key: 'webhook_sending',
    name: 'Webhook Sending',
    description: 'Envío de webhooks (kill switch de emergencia)',
    enabled: true,
    killSwitch: false,
  },
}

/**
 * Hash simple para determinar rollout percentage
 * Usa el userId para determinar si cae en el porcentaje
 */
function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash)
}

/**
 * Determina si un usuario está en el rollout percentage
 */
function isInRolloutPercentage(userId: string, percentage: number): boolean {
  if (percentage === 0) return false
  if (percentage === 100) return true

  const hash = hashString(userId)
  const userPercentile = hash % 100
  return userPercentile < percentage
}

/**
 * Verifica si un feature flag está habilitado
 *
 * @param flagKey - Key del feature flag
 * @param context - Contexto del usuario/organización
 * @returns true si el flag está habilitado para este contexto
 */
export function isFeatureEnabled(
  flagKey: string,
  context: FeatureFlagContext = {}
): boolean {
  const flag = FEATURE_FLAGS[flagKey]

  // Flag no existe, retornar false
  if (!flag) {
    console.warn(`⚠️  Feature flag no encontrado: ${flagKey}`)
    return false
  }

  // Kill switch activado
  if (flag.killSwitch) {
    console.warn(`🔴 Kill switch activado: ${flagKey}`)
    return false
  }

  // Flag deshabilitado globalmente
  if (!flag.enabled) {
    return false
  }

  // Verificar entorno
  const currentEnv = (context.environment || process.env.NODE_ENV || 'development') as FeatureFlagEnvironment
  if (flag.environments && !flag.environments.includes(currentEnv)) {
    return false
  }

  // Verificar fechas
  const now = new Date()
  if (flag.startDate && now < flag.startDate) {
    return false
  }
  if (flag.endDate && now > flag.endDate) {
    return false
  }

  // Verificar whitelist de usuarios
  if (flag.allowedUserIds && flag.allowedUserIds.length > 0) {
    if (!context.userId || !flag.allowedUserIds.includes(context.userId)) {
      return false
    }
  }

  // Verificar whitelist de organizaciones
  if (flag.allowedOrganizationIds && flag.allowedOrganizationIds.length > 0) {
    if (
      !context.organizationId ||
      !flag.allowedOrganizationIds.includes(context.organizationId)
    ) {
      return false
    }
  }

  // Verificar plan
  if (flag.allowedPlans && flag.allowedPlans.length > 0) {
    if (!context.userPlan || !flag.allowedPlans.includes(context.userPlan)) {
      return false
    }
  }

  // Verificar rollout percentage
  if (flag.rolloutPercentage !== undefined && context.userId) {
    return isInRolloutPercentage(context.userId, flag.rolloutPercentage)
  }

  // Si llegamos acá, el flag está habilitado
  return true
}

/**
 * Obtiene todos los flags habilitados para un contexto
 */
export function getEnabledFeatures(context: FeatureFlagContext = {}): string[] {
  return Object.keys(FEATURE_FLAGS).filter((key) =>
    isFeatureEnabled(key, context)
  )
}

/**
 * Obtiene información de un flag
 */
export function getFeatureFlag(flagKey: string): FeatureFlag | null {
  return FEATURE_FLAGS[flagKey] || null
}

/**
 * Obtiene todos los flags
 */
export function getAllFeatureFlags(): Record<string, FeatureFlag> {
  return FEATURE_FLAGS
}

/**
 * Activa un kill switch (útil para emergencias)
 */
export function activateKillSwitch(flagKey: string): void {
  const flag = FEATURE_FLAGS[flagKey]
  if (flag) {
    flag.killSwitch = true
    console.warn(`🔴 Kill switch activado: ${flagKey}`)
  }
}

/**
 * Desactiva un kill switch
 */
export function deactivateKillSwitch(flagKey: string): void {
  const flag = FEATURE_FLAGS[flagKey]
  if (flag) {
    flag.killSwitch = false
    console.warn(`🟢 Kill switch desactivado: ${flagKey}`)
  }
}

/**
 * Hook de React para usar feature flags
 * (usar en componentes client)
 */
export function useFeatureFlag(
  flagKey: string,
  context: FeatureFlagContext = {}
): boolean {
  // En un hook real de React, usarías useState y useEffect
  // Por ahora, retorna el valor directo
  return isFeatureEnabled(flagKey, context)
}

/**
 * Componente wrapper para renderizar basado en feature flag
 *
 * Uso:
 * ```tsx
 * <FeatureFlag flag="dark_mode" context={{ userId }}>
 *   <DarkModeToggle />
 * </FeatureFlag>
 * ```
 */
export function FeatureFlag({
  flag,
  context = {},
  children,
  fallback = null,
}: {
  flag: string
  context?: FeatureFlagContext
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const enabled = isFeatureEnabled(flag, context)
  return enabled ? children : fallback
}

/**
 * Middleware para feature flags en API routes
 *
 * Uso:
 * ```typescript
 * export const GET = withFeatureFlag('advanced_analytics', async (req) => {
 *   // Solo se ejecuta si el flag está habilitado
 * })
 * ```
 */
export function withFeatureFlag<T extends any[]>(
  flagKey: string,
  handler: (...args: T) => Promise<any>,
  options?: {
    getContext?: (...args: T) => FeatureFlagContext
    onDisabled?: () => any
  }
) {
  return async (...args: T): Promise<any> => {
    const context = options?.getContext ? options.getContext(...args) : {}
    const enabled = isFeatureEnabled(flagKey, context)

    if (!enabled) {
      if (options?.onDisabled) {
        return options.onDisabled()
      }

      // Por defecto, retornar 404
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Feature not available',
          message: 'This feature is not available for your account.',
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return handler(...args)
  }
}
