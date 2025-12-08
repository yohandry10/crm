import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasN8nSecret: !!process.env.N8N_WEBHOOK_SECRET,
    urlStart: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 20) || 'NOT SET'
  })
}
