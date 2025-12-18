import { NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { createRequestLogger } from '@/lib/logger'

export async function POST(request: Request) {
    const log = createRequestLogger(request)
    try {
        const supabase = await createSupabaseRouteHandler()
        await supabase.auth.signOut()
        
        const response = NextResponse.json({ success: true })
        
        // Limpiar cookies de sesión
        response.cookies.delete('sb-access-token')
        response.cookies.delete('sb-refresh-token')
        
        return response
    } catch (error) {
        log.error('Logout error', error)
        return NextResponse.json({ success: false }, { status: 500 })
    }
}

export async function GET() {
    try {
        const supabase = await createSupabaseRouteHandler()
        await supabase.auth.signOut()
        
        // Redirigir a login
        return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
    } catch {
        return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'))
    }
}
