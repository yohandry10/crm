import { NextResponse } from "next/server"
import { requirePlatformAdmin } from "@/lib/auth-helpers"
import { sanitizeErrorForClient, getHttpStatusForError } from "@/lib/error-handler"

export async function GET() {
  try {
    const { supabase } = await requirePlatformAdmin()

    const { data, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: sanitizeErrorForClient(error) },
      { status: getHttpStatusForError(error) }
    )
  }
}
