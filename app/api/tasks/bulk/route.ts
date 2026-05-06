import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/auth-context"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { validateTaskReferences } from "@/lib/work-item-references"
import { z } from "zod"

const taskIdsSchema = z.array(z.string().uuid()).min(1, "Se requiere un array de IDs").max(100, "Máximo 100 registros por operación")
const taskBulkUpdatesSchema = z.object({
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
}).strict()

const taskBulkUpdateSchema = z.object({
  ids: taskIdsSchema,
  updates: taskBulkUpdatesSchema,
}).superRefine((payload, ctx) => {
  if (Object.keys(payload.updates).length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["updates"],
      message: "Se requieren campos a actualizar",
    })
  }
})

// Bulk delete tasks
export async function DELETE(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.write)
    if (rate) return rate

    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const { ids } = await request.json()
    const validation = taskIdsSchema.safeParse(ids)

    if (!validation.success) {
      throw new ValidationError("IDs inválidos", validation.error.format())
    }

    const { error, count } = await supabase
      .from("tasks")
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

// Bulk update tasks (e.g., change status, priority)
export async function PATCH(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.write)
    if (rate) return rate

    const { supabase, organizationId } = await getAuthenticatedContext()
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const validation = taskBulkUpdateSchema.safeParse(body)
    if (!validation.success) {
      throw new ValidationError("Datos inválidos", validation.error.format())
    }

    await validateTaskReferences(supabase, organizationId, validation.data.updates)

    const { error, count } = await supabase
      .from("tasks")
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
