import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const leadSourceSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    description: z.string().optional(),
    active: z.boolean().default(true),
})

export async function GET(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.read)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        
        const searchParams = request.nextUrl.searchParams
        const activeOnly = searchParams.get('active') !== 'false'

        let query = supabase
            .from('lead_sources')
            .select('*')
            .eq('organization_id', organizationId)
            .order('name', { ascending: true })

        if (activeOnly) query = query.eq('active', true)

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/lead-sources", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function POST(request: NextRequest) {
    try {
        const rate = await rateLimit(request, RATE_LIMITS.write)
        if (rate) return rate

        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = leadSourceSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        const { data, error } = await supabase
            .from('lead_sources')
            .insert({ ...validation.data, organization_id: organizationId })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/lead-sources", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
