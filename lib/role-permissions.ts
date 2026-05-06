import type { SupabaseClient } from "@supabase/supabase-js"
import { ForbiddenError } from "@/lib/error-handler"
import type { OrgRole } from "@/lib/types/organization"

type PermissionAction =
  | "can_create"
  | "can_read"
  | "can_update"
  | "can_delete"
  | "can_read_all"
  | "can_manage_all"

export async function requireRolePermission(
  supabase: SupabaseClient,
  role: OrgRole,
  resource: string,
  action: PermissionAction
) {
  const { data, error } = await supabase
    .from("role_permissions")
    .select(action)
    .eq("role", role)
    .eq("resource", resource)
    .maybeSingle()

  if (error) throw error

  const permission = data as Partial<Record<PermissionAction, boolean>> | null

  if (!permission?.[action]) {
    throw new ForbiddenError(`Sin permisos para ${action.replace("can_", "")} ${resource}`)
  }
}
