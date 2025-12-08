import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logAudit } from "@/lib/audit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { updateWorkflowSchema } from "@/lib/schemas"
import crypto from "crypto"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from("workflows")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/workflows/[id]`,
            method: "GET",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        // ✅ Validación con Zod
        const validation = updateWorkflowSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({
                success: false,
                error: "Datos inválidos",
                details: validation.error.errors
            }, { status: 400 })
        }

        // Get old data for audit
        const { data: oldData } = await supabase
            .from("workflows")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        const { data, error } = await supabase
            .from("workflows")
            .update(validation.data)
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        // Audit Log
        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "UPDATE_WORKFLOW",
            table: "workflows",
            recordId: id,
            oldData,
            newData: validation.data,
        })

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/workflows/[id]`,
            method: "PUT",
            error,
            requestBody: await request.clone().json().catch(() => undefined),
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId } = await getAuthenticatedContext()

        // Get old data for audit
        const { data: oldData } = await supabase
            .from("workflows")
            .select("*")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .single()

        const { error } = await supabase
            .from("workflows")
            .delete()
            .eq("id", id)
            .eq("organization_id", organizationId)

        if (error) throw error

        // Audit Log
        await logAudit({
            supabase,
            request,
            userId: user.id,
            organizationId,
            action: "DELETE_WORKFLOW",
            table: "workflows",
            recordId: id,
            oldData,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/workflows/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) }, 
            { status: getHttpStatusForError(error) }
        )
    }
}
