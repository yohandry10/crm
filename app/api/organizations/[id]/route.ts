import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { updateOrganizationSchema } from "@/lib/schemas"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

// GET: Get organization details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { supabase, user } = await getAuthenticatedClientAndUser()

        // Verify membership
        const { data: membership, error: memError } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (memError || !membership) {
            return NextResponse.json({ success: false, error: "Not a member" }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data: { ...data, role: membership.role } })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations/[id]", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

// PATCH: Update organization
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { supabase, user } = await getAuthenticatedClientAndUser()
        const body = await request.json()

        // Verify owner/admin role
        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!membership || !['owner', 'admin'].includes(membership.role)) {
            return NextResponse.json({ success: false, error: "No tienes permisos" }, { status: 403 })
        }

        const validation = updateOrganizationSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('organizations')
            .update(validation.data)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations/[id]", method: "PATCH", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

// DELETE: Delete organization (owner only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { supabase, user } = await getAuthenticatedClientAndUser()

        // Verify owner role
        const { data: membership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!membership || membership.role !== 'owner') {
            return NextResponse.json({ success: false, error: "Solo el propietario puede eliminar" }, { status: 403 })
        }

        const { error } = await supabase
            .from('organizations')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true, message: "Organización eliminada" })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations/[id]", method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
