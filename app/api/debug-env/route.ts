import { NextResponse } from 'next/server'

export async function GET() {
    // Check all relevant env vars
    const envCheck = {
        // These should work via next.config.mjs
        RESEND_API_KEY_exists: !!process.env.RESEND_API_KEY,
        RESEND_API_KEY_length: process.env.RESEND_API_KEY?.length || 0,
        RESEND_API_KEY_first3: process.env.RESEND_API_KEY?.substring(0, 3) || 'N/A',
        EMAIL_FROM: process.env.EMAIL_FROM || 'NOT SET',

        // Compare with N8N which we know works
        N8N_WEBHOOK_SECRET_exists: !!process.env.N8N_WEBHOOK_SECRET,
        N8N_BASE_URL: process.env.N8N_BASE_URL || 'NOT SET',

        // Check Supabase for reference
        SUPABASE_URL_exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,

        // Node env
        NODE_ENV: process.env.NODE_ENV,

        // All env keys that contain RESEND
        allEnvKeys: Object.keys(process.env).filter(k =>
            k.includes('RESEND') || k.includes('EMAIL') || k.includes('N8N')
        ),
    }

    return NextResponse.json(envCheck)
}
