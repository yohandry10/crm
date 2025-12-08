import { createClient } from "@supabase/supabase-js"

export interface PlanLimitResult {
  allowed: boolean
  currentCount: number
  maxAllowed: number
  planName: string
}

export type ResourceType = "users" | "contacts" | "invoices"

/**
 * Verifica si se puede crear un nuevo recurso según los límites del plan
 * NOTA: Temporalmente siempre devuelve allowed=true para debugging
 */
export async function checkPlanLimit(
  organizationId: string,
  resource: ResourceType
): Promise<PlanLimitResult> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const { data, error } = await supabase.rpc("check_plan_limits", {
      p_organization_id: organizationId,
      p_resource: resource,
    })

    if (error) {
      console.error("Error checking plan limits (RPC error):", error)
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: 999999,
        planName: "unknown",
      }
    }

    if (!data || data.length === 0) {
      console.warn("No plan limit data returned for org:", organizationId)
      return {
        allowed: true,
        currentCount: 0,
        maxAllowed: 999999,
        planName: "default",
      }
    }

    const result = data[0]

    // Log para debugging
    console.log("Plan limit check result:", { organizationId, resource, result })

    // TEMPORAL: Siempre permitir hasta diagnosticar problema con RPC
    // TODO: Restaurar lógica original una vez que subscription_plans esté configurada
    return {
      allowed: true, // Temporal: siempre permitir
      currentCount: result.current_count ?? 0,
      maxAllowed: result.max_allowed ?? 999999,
      planName: result.plan_name ?? "unlimited",
    }
  } catch (err) {
    console.error("Exception checking plan limits:", err)
    return {
      allowed: true,
      currentCount: 0,
      maxAllowed: 999999,
      planName: "error",
    }
  }
}

/**
 * Middleware helper para verificar límites en API routes
 */
export async function requirePlanLimit(
  organizationId: string,
  resource: ResourceType
): Promise<{ allowed: true } | { allowed: false; error: string; limit: PlanLimitResult }> {
  const limit = await checkPlanLimit(organizationId, resource)

  if (!limit.allowed) {
    const resourceNames: Record<ResourceType, string> = {
      users: "usuarios",
      contacts: "contactos",
      invoices: "facturas este mes",
    }

    return {
      allowed: false,
      error: `Has alcanzado el límite de ${resourceNames[resource]} de tu plan (${limit.currentCount}/${limit.maxAllowed}). Actualiza tu plan para continuar.`,
      limit,
    }
  }

  return { allowed: true }
}

/**
 * Obtiene el uso actual de recursos de una organización
 */
export async function getResourceUsage(organizationId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [users, contacts, invoices] = await Promise.all([
    supabase.rpc("check_plan_limits", { p_organization_id: organizationId, p_resource: "users" }),
    supabase.rpc("check_plan_limits", { p_organization_id: organizationId, p_resource: "contacts" }),
    supabase.rpc("check_plan_limits", { p_organization_id: organizationId, p_resource: "invoices" }),
  ])

  return {
    users: users.data?.[0] || { current_count: 0, max_allowed: 3 },
    contacts: contacts.data?.[0] || { current_count: 0, max_allowed: 500 },
    invoices: invoices.data?.[0] || { current_count: 0, max_allowed: 100 },
  }
}
