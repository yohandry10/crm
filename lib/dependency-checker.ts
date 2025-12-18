import { SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

/**
 * Dependency configuration for each entity type
 */
export interface DependencyConfig {
  table: string
  foreignKey: string
  displayName: string
  countOnly?: boolean
}

/**
 * Result of a dependency check
 */
export interface DependencyCheckResult {
  hasDependencies: boolean
  dependencies: {
    table: string
    count: number
    displayName: string
  }[]
}

/**
 * Dependency configurations for different entity types
 */
const DEPENDENCY_CONFIGS: Record<string, DependencyConfig[]> = {
  contacts: [
    { table: 'invoices', foreignKey: 'contact_id', displayName: 'Facturas' },
    { table: 'opportunities', foreignKey: 'contact_id', displayName: 'Oportunidades' },
    { table: 'quotes', foreignKey: 'contact_id', displayName: 'Cotizaciones' },
    { table: 'tasks', foreignKey: 'contact_id', displayName: 'Tareas' },
    { table: 'activities', foreignKey: 'contact_id', displayName: 'Actividades' },
    { table: 'interactions', foreignKey: 'contact_id', displayName: 'Interacciones' },
    { table: 'calendar_events', foreignKey: 'contact_id', displayName: 'Eventos de calendario' },
    { table: 'synced_emails', foreignKey: 'contact_id', displayName: 'Correos sincronizados' },
    { table: 'whatsapp_messages', foreignKey: 'contact_id', displayName: 'Mensajes de WhatsApp' },
    { table: 'documents', foreignKey: 'contact_id', displayName: 'Documentos' },
  ],
  opportunities: [
    { table: 'quotes', foreignKey: 'opportunity_id', displayName: 'Cotizaciones' },
    { table: 'opportunity_products', foreignKey: 'opportunity_id', displayName: 'Productos de la oportunidad' },
    { table: 'calendar_events', foreignKey: 'opportunity_id', displayName: 'Eventos de calendario' },
    { table: 'activities', foreignKey: 'opportunity_id', displayName: 'Actividades' },
    { table: 'tasks', foreignKey: 'workflow_id', displayName: 'Tareas automatizadas' },
  ],
  products: [
    // Note: invoice_items and quote_items may have product_id in some deployments
    // The checker will gracefully handle if the column doesn't exist
    { table: 'invoice_items', foreignKey: 'product_id', displayName: 'Items en facturas' },
    { table: 'quote_items', foreignKey: 'product_id', displayName: 'Items en cotizaciones' },
  ],
  campaigns: [
    { table: 'campaign_contacts', foreignKey: 'campaign_id', displayName: 'Contactos de la campaña' },
    { table: 'contacts', foreignKey: 'campaign_id', displayName: 'Contactos asociados' },
  ],
}

/**
 * Check dependencies for an entity before deletion
 *
 * @param supabase - Supabase client instance
 * @param entityType - Type of entity (contacts, opportunities, products, campaigns)
 * @param entityId - UUID of the entity to check
 * @param organizationId - Organization ID for multi-tenant isolation
 * @returns Promise<DependencyCheckResult>
 */
export async function checkDependencies(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  organizationId: string
): Promise<DependencyCheckResult> {
  const configs = DEPENDENCY_CONFIGS[entityType]

  if (!configs) {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  const dependencies: DependencyCheckResult['dependencies'] = []

  // Check each dependency configuration
  for (const config of configs) {
    try {
      // Build the query with organization isolation where applicable
      let query = supabase
        .from(config.table)
        .select('id', { count: 'exact', head: true })
        .eq(config.foreignKey, entityId)

      // Add organization_id filter if the table has it
      // Note: Some tables don't have organization_id (like quote_items, invoice_items)
      // They inherit organization through their parent table
      const tablesWithOrgId = [
        'invoices', 'opportunities', 'quotes', 'tasks', 'activities',
        'interactions', 'calendar_events', 'synced_emails', 'whatsapp_messages',
        'documents', 'contacts', 'campaigns', 'inventory'
      ]

      if (tablesWithOrgId.includes(config.table)) {
        query = query.eq('organization_id', organizationId)
      }

      const { count, error } = await query

      if (error) {
        logger.error('Error checking dependencies', error, { table: config.table, entityType, entityId })
        continue
      }

      if (count && count > 0) {
        dependencies.push({
          table: config.table,
          count,
          displayName: config.displayName,
        })
      }
    } catch (error) {
      logger.error('Error checking dependencies', error as Error, { table: config.table, entityType, entityId })
      // Continue checking other dependencies even if one fails
    }
  }

  return {
    hasDependencies: dependencies.length > 0,
    dependencies,
  }
}

/**
 * Format dependency check result into a user-friendly error message
 *
 * @param result - Dependency check result
 * @param entityType - Type of entity
 * @returns Formatted error message
 */
export function formatDependencyError(
  result: DependencyCheckResult,
  entityType: string
): string {
  const entityNames: Record<string, string> = {
    contacts: 'contacto',
    opportunities: 'oportunidad',
    products: 'producto',
    campaigns: 'campaña',
  }

  const entityName = entityNames[entityType] || entityType

  if (!result.hasDependencies) {
    return ''
  }

  const dependencyList = result.dependencies
    .map(dep => `${dep.displayName} (${dep.count})`)
    .join(', ')

  return `No se puede eliminar este ${entityName} porque tiene dependencias: ${dependencyList}. Por favor, elimina primero estos registros relacionados.`
}

/**
 * Check dependencies and throw error if any exist
 *
 * @param supabase - Supabase client instance
 * @param entityType - Type of entity
 * @param entityId - UUID of the entity
 * @param organizationId - Organization ID
 * @throws Error if dependencies exist
 */
export async function checkDependenciesOrThrow(
  supabase: SupabaseClient,
  entityType: string,
  entityId: string,
  organizationId: string
): Promise<void> {
  const result = await checkDependencies(supabase, entityType, entityId, organizationId)

  if (result.hasDependencies) {
    const error = new Error(formatDependencyError(result, entityType)) as any
    error.statusCode = 409
    error.dependencies = result.dependencies
    throw error
  }
}
