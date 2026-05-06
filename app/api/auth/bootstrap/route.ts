import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"
import { ensureUserBootstrap } from "@/lib/auth-bootstrap"
import { createRequestLogger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

  try {
    const { user } = await getAuthenticatedClientAndUser()

    const result = await ensureUserBootstrap({
      userId: user.id,
      email: user.email,
      fullName: user.user_metadata?.full_name || user.user_metadata?.name || null,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
      createOrganizationIfMissing: false,
    })

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    if (error?.message === "Unauthorized") {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 })
    }

    log.error("Auth bootstrap endpoint failed", error)
    return NextResponse.json(
      { success: false, error: "No se pudo inicializar la cuenta" },
      { status: 500 }
    )
  }
}
