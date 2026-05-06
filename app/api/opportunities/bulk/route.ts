import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { validateOpportunityReferences } from "@/lib/work-item-references"
import { requireRolePermission } from "@/lib/role-permissions"
import { z } from "zod"

const opportunityIdsSchema = z.array(z.string().uuid()).min(1, "Se requiere un array de IDs").max(100, "Máximo 100 registros por operación")
const opportunityBulkUpdatesSchema = z.object({
  stage_id: z.string().uuid("ID de etapa inválido").nullable().optional(),
  status: z.enum(["open", "won", "lost"]).optional(),
  assigned_to: z.string().uuid("ID de usuario inválido").nullable().optional(),
}).strict()

const opportunityBulkUpdateSchema = z.object({
  ids: opportunityIdsSchema,
  updates: opportunityBulkUpdatesSchema,
}).superRefine((payload, ctx) => {
  if (Object.keys(payload.updates).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updates"],
      message: "Se requieren campos a actualizar",
    })
  }
})

// Bulk delete opportunities
export async function DELETE(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.write)
    if (rate) return rate

    const { supabase, organizationId, role } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }
    await requireRolePermission(supabase, role, "opportunities", "can_delete")

    const { ids } = await request.json()
    const validation = opportunityIdsSchema.safeParse(ids)

    if (!validation.success) {
      throw new ValidationError("IDs inválidos", validation.error.format())
    }

    const { error, count } = await supabase
      .from("opportunities")
      .delete()
      .eq("organization_id", organizationId)
      .in("id", validation.data)

    if (error) throw error

    return NextResponse.json({
      success: true,
      deleted: count || validation.data.length
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

// Bulk update opportunities (e.g., change stage, status)
export async function PATCH(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.write)
    if (rate) return rate

    const { supabase, organizationId, role } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }
    await requireRolePermission(supabase, role, "opportunities", "can_update")

    const body = await request.json()
    const validation = opportunityBulkUpdateSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError("Datos inválidos", validation.error.format())
    }

    await validateOpportunityReferences(supabase, organizationId, validation.data.updates)

    const { error, count } = await supabase
      .from("opportunities")
      .update(validation.data.updates)
      .eq("organization_id", organizationId)
      .in("id", validation.data.ids)

    if (error) throw error

    return NextResponse.json({
      success: true,
      updated: count || validation.data.ids.length
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
