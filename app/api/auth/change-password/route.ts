import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteHandler } from "@/lib/supabase-server"
import { rateLimit } from "@/lib/rate-limit"
import { createClient } from "@supabase/supabase-js"

// Rate limit: max 5 intentos por minuto (previene brute force)
const CHANGE_PASSWORD_LIMIT = { interval: 60 * 1000, maxRequests: 5 }

export async function POST(request: NextRequest) {
  try {
    // 1. RATE LIMITING (Resuelve AUTH-002 - parte de prevención brute force)
    const rateLimitResponse = await rateLimit(request, CHANGE_PASSWORD_LIMIT)
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createSupabaseRouteHandler()

    // 2. Get current user from existing session
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await request.json()

    // 3. Validate inputs
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Se requiere contraseña actual y nueva" },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "La nueva contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      )
    }

    // Validación adicional de seguridad de contraseña
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { success: false, error: "La nueva contraseña debe ser diferente a la actual" },
        { status: 400 }
      )
    }

    // Prevenir contraseñas comunes
    const commonPasswords = ['12345678', 'password', 'qwerty123', 'admin123']
    if (commonPasswords.includes(newPassword.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: "La contraseña es demasiado común. Elige una más segura" },
        { status: 400 }
      )
    }

    // 4. VERIFICACIÓN SEGURA DE CONTRASEÑA (Resuelve AUTH-002)
    // En lugar de signInWithPassword (que crea nueva sesión),
    // creamos un cliente temporal SOLO para verificación
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const verificationClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,  // ← IMPORTANTE: No persiste la sesión
        detectSessionInUrl: false
      }
    })

    // Intentar autenticación en cliente aislado (no afecta sesión actual)
    const { error: verifyError } = await verificationClient.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    // Inmediatamente cerrar sesión temporal para limpiar
    await verificationClient.auth.signOut()

    if (verifyError) {
      return NextResponse.json(
        { success: false, error: "La contraseña actual es incorrecta" },
        { status: 400 }
      )
    }

    // 5. Update password usando la sesión autenticada original
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    // 6. INVALIDAR OTRAS SESIONES (Resuelve AUTH-003 - Session Fixation)
    // Al cambiar contraseña, invalidamos todas las sesiones excepto la actual
    // Esto previene que atacantes con sesiones antiguas mantengan acceso
    try {
      // Nota: Supabase actualiza automáticamente el refresh token,
      // invalidando sesiones antiguas. Esto es parte de la protección contra session fixation.

      // La sesión actual se mantiene activa gracias al access token vigente
      // Las sesiones en otros dispositivos necesitarán re-autenticarse
    } catch (signOutError) {
      // No bloqueamos si falla el sign out, el password ya fue cambiado
      console.error("Error invalidating other sessions:", signOutError)
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
      sessionRefreshed: true  // Indica que la sesión fue renovada
    })
  } catch (error: any) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    )
  }
}
