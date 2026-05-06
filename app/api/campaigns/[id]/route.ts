import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedContext } from "@/lib/supabase-auth"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError, ValidationError } from "@/lib/error-handler"
import { z } from "zod"
import crypto from "crypto"

const campaignUpdateSchema = z.object({
    name: z.string().min(1, "Nombre requerido").optional(),
    description: z.string().optional().nullable(),
    type: z.enum(['email', 'whatsapp', 'sms', 'mixed']).optional(),
    status: z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled']).optional(),
    target_segment: z.record(z.any()).optional().nullable(),
    subject: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    scheduled_at: z.string().datetime().optional().nullable(),
    budget: z.coerce.number().min(0).optional(),
})

function validateCampaignReadyForStatus(campaign: any) {
    if (campaign.status !== 'active' && campaign.status !== 'scheduled') return

    if (!campaign.content || campaign.content.trim().length === 0) {
        throw new ValidationError("El contenido de la campaña es requerido antes de activar")
    }

    if (campaign.type === 'email' && (!campaign.subject || campaign.subject.trim().length === 0)) {
        throw new ValidationError("El asunto es requerido para campañas de email")
    }

    if (campaign.status === 'scheduled' && !campaign.scheduled_at) {
        throw new ValidationError("La fecha de programación es requerida")
    }

    if (Number(campaign.contact_count || 0) <= 0) {
        throw new ValidationError("La campaña necesita una audiencia antes de activarse o programarse")
    }
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

        const { data, error } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (error) throw error
        if (!data) {
            return NextResponse.json({ success: false, error: "Campaña no encontrada" }, { status: 404 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/campaigns/[id]", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()
        const body = await request.json()

        const validation = campaignUpdateSchema.safeParse(body)
        if (!validation.success) {
            throw new ValidationError("Datos inválidos", validation.error.format())
        }

        // Verificar que la campaña pertenece a la organización
        const { data: existing, error: checkError } = await supabase
            .from('campaigns')
            .select('*')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Campaña no encontrada" }, { status: 404 })
        }

        validateCampaignReadyForStatus({ ...existing, ...validation.data })

        const { data, error } = await supabase
            .from('campaigns')
            .update({ ...validation.data, updated_at: new Date().toISOString() })
            .eq('id', id)
            .eq('organization_id', organizationId)
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/campaigns/[id]", method: "PUT", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { supabase, organizationId } = await getAuthenticatedContext()

        // Verificar que la campaña pertenece a la organización
        const { data: existing, error: checkError } = await supabase
            .from('campaigns')
            .select('id')
            .eq('id', id)
            .eq('organization_id', organizationId)
            .single()

        if (checkError || !existing) {
            return NextResponse.json({ success: false, error: "Campaña no encontrada" }, { status: 404 })
        }

        // Check for dependencies before deletion
        const { checkDependencies } = await import('@/lib/dependency-checker')
        const dependencyCheck = await checkDependencies(supabase, 'campaigns', id, organizationId)

        if (dependencyCheck.hasDependencies) {
            return NextResponse.json({
                success: false,
                error: "No se puede eliminar esta campaña porque tiene registros relacionados",
                dependencies: dependencyCheck.dependencies
            }, { status: 409 })
        }

        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', id)
            .eq('organization_id', organizationId)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/campaigns/[id]", method: "DELETE", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
