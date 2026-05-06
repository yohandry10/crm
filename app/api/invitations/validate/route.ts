import { type NextRequest, NextResponse } from "next/server"
import { createSupabaseServiceClient } from "@/lib/supabase-service"
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit"
import { z } from "zod"

const validateInvitationSchema = z.object({
  token: z.string().trim().min(32).max(128).regex(/^[A-Za-z0-9_-]+$/),
})

export async function POST(request: NextRequest) {
  try {
    const rate = await rateLimit(request, RATE_LIMITS.sensitive)
    if (rate) return rate

    const parsed = validateInvitationSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from("organization_invitations")
      .select("id, email, role, organization_id, status, expires_at, accepted_at, organizations(name)")
      .eq("token", parsed.data.token)
      .eq("status", "pending")
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Invitation invalid or expired" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
