import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRequestLogger } from '@/lib/logger'
import { ensureUserBootstrap } from '@/lib/auth-bootstrap'
import { sanitizeAuthRedirect } from '@/lib/auth-password-policy'

export async function GET(request: NextRequest) {
    const log = createRequestLogger(request)
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const redirect = sanitizeAuthRedirect(requestUrl.searchParams.get('redirect'), '/dashboard')
    const error = requestUrl.searchParams.get('error')
    const errorDescription = requestUrl.searchParams.get('error_description')

    // Manejar errores de OAuth
    if (error) {
        log.warn('OAuth error in callback', { error, errorDescription })
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', error)
        if (errorDescription) {
            loginUrl.searchParams.set('error_description', errorDescription)
        }
        return NextResponse.redirect(loginUrl)
    }

    if (!code) {
        log.warn('No code provided in auth callback')
        return NextResponse.redirect(new URL('/login?error=no_code', request.url))
    }

    try {
        const supabase = await createSupabaseRouteHandler()
        
        // Intercambiar código por sesión
        const { data: { session }, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        
        if (exchangeError) {
            log.error('Auth callback exchange error', exchangeError)
            return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
        }

        // Asegurar bootstrap del usuario autenticado
        if (session?.user) {
            const invitationToken = session.user.user_metadata?.invitation_token as string | undefined
            const fullName =
                session.user.user_metadata?.full_name ||
                session.user.user_metadata?.name ||
                session.user.email?.split('@')[0] ||
                null
            const avatarUrl =
                session.user.user_metadata?.avatar_url ||
                session.user.user_metadata?.picture ||
                null

            try {
                // 1) Ensure profile exists first, but avoid creating a personal org
                // yet if the user comes from an invitation.
                await ensureUserBootstrap({
                    userId: session.user.id,
                    email: session.user.email,
                    fullName,
                    avatarUrl,
                    createOrganizationIfMissing: false,
                })
            } catch (bootstrapError) {
                log.error('Error bootstrapping user after OAuth', bootstrapError)
            }

            // Crear configuración inicial (best-effort)
            try {
                await supabase
                    .from('user_settings')
                    .upsert({ user_id: session.user.id }, { onConflict: 'user_id' })
            } catch (settingsError) {
                log.error('Error creating user settings for OAuth user', settingsError)
            }

            if (invitationToken) {
                const { data: acceptResult, error: acceptError } = await supabase.rpc(
                    'accept_organization_invitation',
                    { p_token: invitationToken }
                )
                if (acceptError || acceptResult?.success === false) {
                    log.warn('Invitation accept failed on auth callback', {
                        invitationToken,
                        error: acceptError?.message || acceptResult?.error,
                    })
                }
            }

            try {
                // 2) Final reconciliation: keep profile aligned after invitation handling.
                // Organizations are provisioned by platform admins, not by self-service signup.
                await ensureUserBootstrap({
                    userId: session.user.id,
                    email: session.user.email,
                    fullName,
                    avatarUrl,
                    createOrganizationIfMissing: false,
                })
            } catch (bootstrapError) {
                log.error('Error reconciling user bootstrap after OAuth', bootstrapError)
            }
        }

        // Redirigir al dashboard o a la página solicitada
        return NextResponse.redirect(new URL(redirect, request.url))
    } catch (err) {
        log.error('Unexpected error in auth callback', err)
        return NextResponse.redirect(new URL('/login?error=unexpected', request.url))
    }
}
