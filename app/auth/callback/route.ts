import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const redirect = requestUrl.searchParams.get('redirect') || '/dashboard'
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    // Manejar errores de OAuth
    if (error) {
        console.error('OAuth error:', error, errorDescription)
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', error)
        if (errorDescription) {
            loginUrl.searchParams.set('error_description', errorDescription)
        }
        return NextResponse.redirect(loginUrl)
    }

    if (!code) {
        console.error('No code provided in callback')
        return NextResponse.redirect(new URL('/login?error=no_code', request.url))
    }

    try {
        const supabase = await createSupabaseRouteHandler()
        
        // Intercambiar código por sesión
        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        
        if (exchangeError) {
            console.error('Auth callback error:', exchangeError)
            return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
        }

        // Si es un usuario nuevo (OAuth), crear perfil
        if (session?.user) {
            const { data: existingProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .single()

            if (!existingProfile) {
                // Crear perfil para usuario nuevo (OAuth)
                const { error: profileError } = await supabase.from('profiles').insert({
                    id: session.user.id,
                    email: session.user.email,
                    full_name: session.user.user_metadata?.full_name || 
                               session.user.user_metadata?.name ||
                               session.user.email?.split('@')[0],
                    avatar_url: session.user.user_metadata?.avatar_url ||
                                session.user.user_metadata?.picture,
                    role: 'user',
                })

                if (profileError) {
                    console.error('Error creating profile:', profileError)
                    // No fallar, el usuario puede continuar
                }

                // Crear configuración inicial
                const { error: settingsError } = await supabase.from('user_settings').insert({
                    user_id: session.user.id,
                })

                if (settingsError) {
                    console.error('Error creating user settings:', settingsError)
                }
            }
        }

        // Redirigir al dashboard o a la página solicitada
        return NextResponse.redirect(new URL(redirect, request.url))
    } catch (err) {
        console.error('Unexpected error in auth callback:', err)
        return NextResponse.redirect(new URL('/login?error=unexpected', request.url))
    }
}
