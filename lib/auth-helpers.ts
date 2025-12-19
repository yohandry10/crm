import { createAuthenticatedClient } from "@/lib/supabase-auth"
import { createSupabaseRouteHandler } from "@/lib/supabase-server"

/**
 * Verifica que el usuario actual sea un platform admin
 * @throws Error si no está autenticado o no es platform admin
 */
export async function requirePlatformAdmin() {
  let supabase
  let user

  try {
    const result = await createAuthenticatedClient()
    supabase = result.supabase
    const { data: { user: authUser }, error } = await supabase.auth.getUser()

    if (error || !authUser) {
      throw new Error("Unauthorized")
    }

    user = authUser
  } catch {
    // Fallback to route handler
    supabase = await createSupabaseRouteHandler()
    const { data: { user: authUser }, error } = await supabase.auth.getUser()

    if (error || !authUser) {
      throw new Error("Unauthorized")
    }

    user = authUser
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_platform_admin")
    .eq("id", user.id)
    .single()

  if (!error && profile?.is_platform_admin) {
    return { supabase, user }
  }

  const allowlistRaw = process.env.PLATFORM_ADMIN_EMAILS || ""
  const allowlist = allowlistRaw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)

  const userEmail = (user.email || "").toLowerCase()
  const isAllowlisted = userEmail && allowlist.includes(userEmail)

  if (isAllowlisted) {
    try {
      await supabase.from("profiles").update({ is_platform_admin: true }).eq("id", user.id)
    } catch {
      // Best effort; allowlist still grants access.
    }
    return { supabase, user }
  }

  throw new Error("Forbidden: Platform admin access required")
}

/**
 * Enmascara un email mostrando solo el primer carácter y el dominio
 * Ejemplo: john.doe@example.com -> j********@example.com
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') {
    return '***@***.***'
  }

  const [localPart, domain] = email.split('@')

  if (!localPart || !domain) {
    return '***@***.***'
  }

  const maskedLocal = localPart.charAt(0) + '*'.repeat(Math.max(localPart.length - 1, 3))
  return `${maskedLocal}@${domain}`
}

/**
 * Enmascara un RUC mostrando solo los últimos 3 dígitos
 * Ejemplo: 20123456789 -> ********789
 */
export function maskRUC(ruc: string | null | undefined): string | null {
  if (!ruc || typeof ruc !== 'string') {
    return null
  }

  if (ruc.length < 4) {
    return '*'.repeat(ruc.length)
  }

  const visibleDigits = ruc.slice(-3)
  const maskedPart = '*'.repeat(ruc.length - 3)
  return maskedPart + visibleDigits
}

/**
 * Valida parámetros de paginación y retorna valores seguros
 */
export function validatePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
  const offset = (page - 1) * limit

  return { page, limit, offset }
}
