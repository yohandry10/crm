import { NextRequest, NextResponse } from "next/server"
import { createSupabaseRouteHandler } from "@/lib/supabase-server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteHandler()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json(
        { success: false, error: "No autorizado" },
        { status: 401 }
      )
    }

    const { currentPassword, newPassword } = await request.json()

    // Validate inputs
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

    // Verify current password by trying to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    })

    if (signInError) {
      return NextResponse.json(
        { success: false, error: "La contraseña actual es incorrecta" },
        { status: 400 }
      )
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    })

    if (updateError) {
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente"
    })
  } catch (error: any) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
