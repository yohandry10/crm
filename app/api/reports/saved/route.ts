import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { reportConfigSchema } from "@/lib/report-contracts"
import crypto from "crypto"

const READ_LIMIT = { interval: 60 * 1000, maxRequests: 50 }
const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 20 }

function serializeSavedReport(report: any) {
  return {
    id: report.id,
    name: report.name,
    ...(report.config || {}),
    created_at: report.created_at,
    updated_at: report.updated_at,
  }
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, READ_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, organizationId } = await getAuthenticatedContext()

    const { data, error } = await supabase
      .from("saved_reports")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (error) throw error

    return NextResponse.json({ success: true, data: (data || []).map(serializeSavedReport) })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/reports/saved",
      method: "GET",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const { supabase, user, organizationId } = await getAuthenticatedContext()
    const parsed = reportConfigSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Configuración de reporte inválida", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const config = parsed.data

    const { data, error } = await supabase
      .from("saved_reports")
      .insert({
        organization_id: organizationId,
        created_by: user.id,
        name: config.name,
        config: {
          type: config.type,
          entity: config.entity,
          metrics: config.metrics,
          groupBy: config.groupBy,
          dateRange: config.dateRange,
          filters: config.filters,
        },
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data: serializeSavedReport(data) })

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/reports/saved",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
