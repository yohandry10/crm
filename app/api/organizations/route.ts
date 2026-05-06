import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

// GET: List user's organizations
export async function GET(_request: NextRequest) {
    try {
        const { supabase, user } = await getAuthenticatedClientAndUser()

        const { data, error } = await supabase
            .from('organization_members')
            .select(`
                role,
                is_active,
                organization:organizations(*)
            `)
            .eq('user_id', user.id)
            .eq('is_active', true)

        if (error) throw error

        const organizations = data?.map(m => ({
            ...m.organization,
            role: m.role,
        })) || []

        return NextResponse.json({ success: true, data: organizations })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

// POST: Create new organization
export async function POST(request: NextRequest) {
    try {
        await getAuthenticatedClientAndUser()
        void request

        return NextResponse.json(
            {
                success: false,
                error: "Las organizaciones se crean desde el panel de superadmin",
            },
            { status: 403 }
        )
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
