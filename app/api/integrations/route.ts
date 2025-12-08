import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"
import { testConnection } from "@/lib/integrations"

const integrationSchema = z.object({
    name: z.string().min(1, "Nombre requerido").max(100),
    provider: z.string().min(1, "Proveedor requerido"),
    config: z.record(z.any()).optional(),
    is_active: z.boolean().default(true)
})

export async function GET(_request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("integrations")
            .select("*")
            .eq("organization_id", organizationId)
            .order("created_at", { ascending: false })

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/integrations", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = integrationSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const connectionResult = await testConnection(validation.data.provider, validation.data.config || {})
        const status = connectionResult.success ? "connected" : "error"

        const { data, error } = await supabase
            .from("integrations")
            .insert({ ...body, status, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        await logAudit({ supabase, request, userId: user.id, organizationId, action: "CREATE_INTEGRATION", table: "integrations", recordId: data.id, newData: body })

        return NextResponse.json({ success: true, data, connection: connectionResult })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/integrations", method: "POST", error, requestBody: await request.clone().json().catch(() => undefined) })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
