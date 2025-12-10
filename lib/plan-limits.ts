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
 */
export async function checkPlanLimit(
  organizationId: string,
  resource: ResourceType
): Promise<PlanLimitResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials for plan limits check")
  }

  const supabase = createClient(url, serviceKey)

  try {
    const { data, error } = await supabase.rpc("check_plan_limits", {
      p_organization_id: organizationId,
      p_resource: resource,
    })

    if (error) throw error

    if (!data || data.length === 0) {
      console.warn("No plan limit data returned for org:", organizationId)
      return {
        allowed: false,
        currentCount: 0,
        maxAllowed: 0,
        planName: "unknown",
      }
    }

    const result = data[0]
    const currentCount = result.current_count ?? 0
    const maxAllowed = result.max_allowed ?? 0
    const planName = result.plan_name ?? "unknown"
    const allowed = typeof result.allowed === "boolean"
      ? result.allowed
      : currentCount < maxAllowed

    console.log("Plan limit check result:", { organizationId, resource, currentCount, maxAllowed, planName, allowed })

    return {
      allowed,
      currentCount,
      maxAllowed,
      planName,
    }
  } catch (err) {
    console.error("Exception checking plan limits:", err)
    return {
      allowed: false,
      currentCount: 0,
      maxAllowed: 0,
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
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error("Missing Supabase credentials for plan limits check")
  }

  const supabase = createClient(url, serviceKey)

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
