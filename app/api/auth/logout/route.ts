import { NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { createRequestLogger } from '@/lib/logger'
import { logAuthAudit } from '@/lib/audit'

export async function POST(request: Request) {
    const log = createRequestLogger(request)
    try {
        const supabase = await createSupabaseRouteHandler()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await logAuthAudit({
                request,
                action: 'LOGOUT',
                userId: user.id,
                email: user.email,
                success: true,
            })
        }
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

export async function GET(request: Request) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/+$/, "") || new URL(request.url).origin
    try {
        const supabase = await createSupabaseRouteHandler()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
            await logAuthAudit({
                request,
                action: 'LOGOUT',
                userId: user.id,
                email: user.email,
                success: true,
            })
        }
        await supabase.auth.signOut()
        
        // Redirigir a login
        return NextResponse.redirect(new URL('/login', baseUrl))
    } catch {
        return NextResponse.redirect(new URL('/login', baseUrl))
    }
}
