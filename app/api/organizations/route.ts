import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { createOrganizationSchema } from "@/lib/schemas"
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
        const { supabase, user } = await getAuthenticatedClientAndUser()
        const body = await request.json()

        const validation = createOrganizationSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Validation failed", details: validation.error.errors }, { status: 400 })
        }

        const { name, slug: providedSlug, ...rest } = validation.data
        const slug = providedSlug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

        // Check slug uniqueness
        const { data: existing } = await supabase
            .from('organizations')
            .select('id')
            .eq('slug', slug)
            .single()

        if (existing) {
            return NextResponse.json({ success: false, error: "Este slug ya está en uso" }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('organizations')
            .insert({
                name,
                slug,
                ...rest,
                created_by: user.id,
            })
            .select()
            .single()

        if (error) throw error

        // Trigger will auto-create owner membership
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
