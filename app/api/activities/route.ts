import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"
import { getPaginationParams } from "@/lib/pagination"
import { requireRolePermission } from "@/lib/role-permissions"

const activitySchema = z.object({
    activity_type: z.enum(['call', 'email', 'meeting', 'whatsapp', 'note', 'task_completed', 'deal_won', 'deal_lost']),
    contact_id: z.string().uuid().optional().nullable(),
    opportunity_id: z.string().uuid().optional().nullable(),
    invoice_id: z.string().uuid().optional().nullable(),
    subject: z.string().optional(),
    description: z.string().optional(),
    outcome: z.string().optional(),
    scheduled_at: z.string().datetime().optional().nullable(),
    completed_at: z.string().datetime().optional().nullable(),
    duration_minutes: z.number().int().min(0).optional(),
    next_action: z.string().optional(),
    next_action_date: z.string().datetime().optional().nullable(),
})

export async function GET(request: NextRequest) {
    try {
        const { supabase, organizationId } = await getAuthenticatedContext()
        
        const searchParams = request.nextUrl.searchParams
        const contact_id = searchParams.get('contact_id')
        const activity_type = searchParams.get('activity_type')
        const { page, limit, offset } = getPaginationParams(searchParams)

        let query = supabase
            .from('activities')
            .select('*, contact:contacts(id, name, email)', { count: 'exact' })
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)

        if (contact_id) query = query.eq('contact_id', contact_id)
        if (activity_type) query = query.eq('activity_type', activity_type)

        const { data, error, count } = await query
        if (error) throw error

        return NextResponse.json({
            success: true, data,
            pagination: { page, limit, total: count || 0, totalPages: Math.ceil((count || 0) / limit) }
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/activities", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const { supabase, user, organizationId, role } = await getAuthenticatedContext()
        await requireRolePermission(supabase, role, "activities", "can_create")
        const body = await request.json()

        const validation = activitySchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { data, error } = await supabase
            .from('activities')
            .insert({ ...validation.data, organization_id: organizationId, created_by: user.id })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/activities", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
