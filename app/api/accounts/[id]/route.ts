import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { accountSchema } from "@/lib/schemas"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import crypto from "crypto"
import { requireCanManageRecord, requireRolePermission } from "@/lib/role-permissions"

const WRITE_LIMIT = RATE_LIMITS.write

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    let requestBody: any = undefined
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "accounts", "can_update")
        const { id } = await params
        requestBody = await request.json()

        const validation = accountSchema.safeParse(requestBody)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Datos inválidos", details: validation.error.format() }, { status: 400 })
        }

        const { data: existingAccount } = await supabase
            .from("accounts")
            .select("created_by")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle()

        if (!existingAccount) return NextResponse.json({ success: false, error: "Cuenta no encontrada" }, { status: 404 })
        await requireCanManageRecord(supabase, { role, resource: "accounts", recordOwnerId: existingAccount.created_by, userId: user.id })

        const { error, data } = await supabase
            .from("accounts")
            .update({ ...validation.data })
            .eq("id", id)
            .eq("organization_id", organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/accounts/[id]`,
            method: "PUT",
            error,
            requestBody,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const rate = await rateLimit(request, WRITE_LIMIT)
        if (rate) return rate

        // MULTI-TENANT: Get organization context
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "accounts", "can_delete")
        const { id } = await params

        const { data: existingAccount } = await supabase
            .from("accounts")
            .select("created_by")
            .eq("id", id)
            .eq("organization_id", organizationId)
            .maybeSingle()

        if (!existingAccount) return NextResponse.json({ success: false, error: "Cuenta no encontrada" }, { status: 404 })
        await requireCanManageRecord(supabase, { role, resource: "accounts", recordOwnerId: existingAccount.created_by, userId: user.id })

        const { error } = await supabase
            .from("accounts")
            .delete()
            .eq("id", id)
            .eq("organization_id", organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({
            errorId: crypto.randomUUID(),
            endpoint: `/api/accounts/[id]`,
            method: "DELETE",
            error,
        })
        return NextResponse.json(
            { success: false, error: sanitizeErrorForClient(error) },
            { status: getHttpStatusForError(error) }
        )
    }
}
