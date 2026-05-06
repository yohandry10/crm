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

export async function getRolePermission(
  supabase: SupabaseClient,
  role: OrgRole,
  resource: string
) {
  const { data, error } = await supabase
    .from("role_permissions")
    .select("can_create, can_read, can_update, can_delete, can_read_all, can_manage_all")
    .eq("role", role)
    .eq("resource", resource)
    .maybeSingle()

  if (error) throw error

  return data as Partial<Record<PermissionAction, boolean>> | null
}

export async function requireRolePermission(
  supabase: SupabaseClient,
  role: OrgRole,
  resource: string,
  action: PermissionAction
) {
  const permission = await getRolePermission(supabase, role, resource)

  if (!permission?.[action]) {
    throw new ForbiddenError(`Sin permisos para ${action.replace("can_", "")} ${resource}`)
  }
}

export async function requireCanManageRecord(
  supabase: SupabaseClient,
  input: {
    role: OrgRole
    resource: string
    recordOwnerId?: string | null
    userId: string
  }
) {
  const permission = await getRolePermission(supabase, input.role, input.resource)

  if (!permission?.can_manage_all && input.recordOwnerId !== input.userId) {
    throw new ForbiddenError(`Sin permisos para gestionar registros de otros usuarios en ${input.resource}`)
  }
}
