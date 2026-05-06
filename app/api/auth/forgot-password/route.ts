import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import { rateLimit } from "@/lib/rate-limit"
import { createRequestLogger } from "@/lib/logger"
import { getServerAppBaseUrl } from "@/lib/server-app-url"

const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

const FORGOT_PASSWORD_LIMIT = { interval: 60 * 1000, maxRequests: 3 }

export async function POST(request: NextRequest) {
  const log = createRequestLogger(request)

  const rateLimitResponse = await rateLimit(request, FORGOT_PASSWORD_LIMIT)
  if (rateLimitResponse) return rateLimitResponse

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: "JSON inválido" },
        { status: 400 }
      )
    }

    const parsed = forgotPasswordSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Email inválido" },
        { status: 400 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      log.error("Forgot password env missing", new Error("Supabase env missing"))
      return NextResponse.json(
        { success: false, error: "Servicio no configurado" },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    })

    const resetUrl = new URL("/reset-password", getServerAppBaseUrl(request))
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email.toLowerCase().trim(), {
      redirectTo: resetUrl.toString(),
    })

    if (error) {
      // Do not reveal whether the account exists or whether provider delivery failed.
      log.warn("Password reset request failed", {
        emailDomain: parsed.data.email.split("@")[1] || "unknown",
        error: error.message,
      })
    }

    return NextResponse.json({
      success: true,
      message: "Si el email existe, enviaremos instrucciones para restablecer la contraseña.",
    })
  } catch (error) {
    log.error("Forgot password error", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
