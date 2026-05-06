import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit } from "@/lib/rate-limit"
import { z } from "zod"
import crypto from "crypto"

const WRITE_LIMIT = { interval: 60 * 1000, maxRequests: 10 }
const exportFormatSchema = z.enum(["csv", "xlsx"]).default("csv")
const exportPayloadSchema = z.object({
  config: z.object({
    name: z.string().trim().max(100).optional(),
  }).passthrough().optional().default({}),
  data: z.object({
    columns: z.array(z.string().min(1).max(80)).min(1).max(50),
    rows: z.array(z.record(z.any())).max(5000),
  }).passthrough(),
})

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80) || "reporte"
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimit(request, WRITE_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    await getAuthenticatedContext() // Verify auth

    const formatParse = exportFormatSchema.safeParse(request.nextUrl.searchParams.get("format") || undefined)
    if (!formatParse.success) {
      return NextResponse.json(
        { success: false, error: "Formato no soportado" },
        { status: 400 }
      )
    }

    const parsed = exportPayloadSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Datos de exportación inválidos", details: parsed.error.format() },
        { status: 400 }
      )
    }

    const { config, data } = parsed.data
    const format = formatParse.data
    const filename = `${safeFilename(config.name || "reporte")}-${new Date().toISOString().split("T")[0]}`

    if (format === "csv") {
      const csv = generateCSV(data.columns, data.rows)
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}.csv"`,
        },
      })
    }

    if (format === "xlsx") {
      // Simple XLSX-like format (tab-separated for Excel compatibility)
      const tsv = generateTSV(data.columns, data.rows)
      return new NextResponse(tsv, {
        headers: {
          "Content-Type": "application/vnd.ms-excel",
          "Content-Disposition": `attachment; filename="${filename}.xls"`,
        },
      })
    }

  } catch (error: any) {
    await logError({
      errorId: crypto.randomUUID(),
      endpoint: "/api/reports/export",
      method: "POST",
      error,
    })
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}

function generateCSV(columns: string[], rows: any[]): string {
  const header = columns.map(escapeCSV).join(",")
  const body = rows.map(row => 
    columns.map(col => escapeCSV(String(row[col] ?? ""))).join(",")
  ).join("\n")
  
  // Add BOM for Excel UTF-8 compatibility
  return "\uFEFF" + header + "\n" + body
}

function generateTSV(columns: string[], rows: any[]): string {
  const header = columns.join("\t")
  const body = rows.map(row => 
    columns.map(col => String(row[col] ?? "")).join("\t")
  ).join("\n")
  
  return header + "\n" + body
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
