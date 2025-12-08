import { NextRequest, NextResponse } from "next/server"
import { getAuthenticatedClientAndUser } from "@/lib/supabase-auth"

// GET - Get current user profile
export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClientAndUser()

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// PUT - Update current user profile
export async function PUT(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClientAndUser()
    const body = await request.json()

    const { full_name, phone, company_name, job_title } = body

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name,
        phone,
        company_name,
        job_title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
