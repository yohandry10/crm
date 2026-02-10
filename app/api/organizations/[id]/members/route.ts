import { type NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { inviteMemberSchema } from "@/lib/schemas"
import { sendEmail, invitationEmailTemplate, isEmailConfigured } from "@/lib/email"
import { logError } from "@/lib/error-logging"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"
import crypto from "crypto"

// GET: List organization members
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { supabase, user } = await getAuthenticatedClientAndUser()

        // Verify membership
        const { data: myMembership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!myMembership) {
            return NextResponse.json({ success: false, error: "Not a member" }, { status: 403 })
        }

        const { data, error } = await supabase
            .from('organization_members')
            .select(`
                *,
                user:profiles(id, email, full_name, avatar_url)
            `)
            .eq('organization_id', id)
            .order('created_at', { ascending: true })

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations/[id]/members", method: "GET", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}

// POST: Invite new member
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const { supabase, user } = await getAuthenticatedClientAndUser()
        const body = await request.json()

        // Verify admin role
        const { data: myMembership } = await supabase
            .from('organization_members')
            .select('role')
            .eq('organization_id', id)
            .eq('user_id', user.id)
            .eq('is_active', true)
            .single()

        if (!myMembership || !['owner', 'admin'].includes(myMembership.role)) {
            return NextResponse.json({ success: false, error: "No tienes permisos para invitar" }, { status: 403 })
        }

        const validation = inviteMemberSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json({ success: false, error: "Validation failed" }, { status: 400 })
        }

        const { email, role } = validation.data

        // Check if already member
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .single()

        if (existingUser) {
            const { data: existingMember } = await supabase
                .from('organization_members')
                .select('id')
                .eq('organization_id', id)
                .eq('user_id', existingUser.id)
                .single()

            if (existingMember) {
                return NextResponse.json({ success: false, error: "Este usuario ya es miembro" }, { status: 400 })
            }

            // Add directly if user exists
            const { data, error } = await supabase
                .from('organization_members')
                .insert({
                    organization_id: id,
                    user_id: existingUser.id,
                    role,
                    invited_by: user.id,
                    accepted_at: new Date().toISOString(),
                    is_active: true,
                })
                .select()
                .single()

            if (error) throw error
            return NextResponse.json({ success: true, data, message: "Miembro agregado" })
        }

        // Create invitation for non-existing user
        const { data, error } = await supabase
            .from('organization_invitations')
            .insert({
                organization_id: id,
                email,
                role,
                invited_by: user.id,
            })
            .select()
            .single()

        if (error) throw error

        // Send invitation email (best-effort).
        const token = data?.token as string | undefined
        const inviteBaseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "http://localhost:3000"
        const inviteLink = token ? `${inviteBaseUrl}/signup?token=${token}` : `${inviteBaseUrl}/signup`

        let emailSent = false
        if (token && isEmailConfigured()) {
            try {
                const [{ data: org }, { data: inviter }] = await Promise.all([
                    supabase.from("organizations").select("name").eq("id", id).single(),
                    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
                ])

                const result = await sendEmail({
                    to: email,
                    subject: `Invitación a ${org?.name || "tu organización"}`,
                    html: invitationEmailTemplate({
                        organizationName: org?.name || "la organización",
                        inviterName: inviter?.full_name || undefined,
                        role,
                        inviteLink,
                    }),
                })
                emailSent = result.success
            } catch {
                emailSent = false
            }
        }

        return NextResponse.json({
            success: true,
            data,
            message: emailSent ? "Invitación enviada por email" : "Invitación creada",
            meta: { inviteLink, emailSent },
        })
    } catch (error: any) {
        await logError({ errorId: crypto.randomUUID(), endpoint: "/api/organizations/[id]/members", method: "POST", error })
        return NextResponse.json({ success: false, error: sanitizeErrorForClient(error) }, { status: getHttpStatusForError(error) })
    }
}
