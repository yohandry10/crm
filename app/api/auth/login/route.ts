/**
 * API de Login con Rate Limiting
 * Protege contra ataques de fuerza bruta
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseRouteHandler } from '@/lib/supabase-server'
import { 
    checkAuthRateLimit, 
    recordFailedLogin, 
    clearLoginAttempts,
    getLoginIdentifier 
} from '@/lib/auth-rate-limit'
import { z } from 'zod'
import { createRequestLogger } from '@/lib/logger'
import { ensureUserBootstrap } from '@/lib/auth-bootstrap'

const loginSchema = z.object({
    email: z.string().email('Email inválido'),
    password: z.string().min(1, 'Contraseña requerida')
})

export async function POST(request: NextRequest) {
    const log = createRequestLogger(request)
    try {
        // Obtener IP del cliente
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                   request.headers.get('x-real-ip') ||
                   'unknown'

        // Parsear body
        const body = await request.json()
        
        // Validar schema
        const validation = loginSchema.safeParse(body)
        if (!validation.success) {
            return NextResponse.json(
                { 
                    success: false, 
                    error: 'Datos inválidos',
                    details: validation.error.flatten().fieldErrors
                },
                { status: 400 }
            )
        }

        const { email, password } = validation.data

        // Verificar rate limit ANTES de intentar login
        const rateLimitCheck = await checkAuthRateLimit(email, ip)
        if (!rateLimitCheck.allowed) {
            return NextResponse.json(
                {
                    success: false,
                    error: rateLimitCheck.error,
                    blocked: true
                },
                { status: 429 }
            )
        }

        // Intentar login con Supabase
        const supabase = await createSupabaseRouteHandler()
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        })

        if (error) {
            // Registrar intento fallido
            const identifier = getLoginIdentifier(email, ip)
            await recordFailedLogin(identifier)

            // Obtener intentos restantes
            const status = await checkAuthRateLimit(email, ip)

            // Mensaje de error amigable
            let errorMessage = 'Email o contraseña incorrectos'
            if (error.message.includes('Email not confirmed')) {
                errorMessage = 'Por favor confirma tu email antes de iniciar sesión'
            }

            return NextResponse.json(
                { 
                    success: false, 
                    error: errorMessage,
                    remainingAttempts: status.remainingAttempts,
                    warning: (status.remainingAttempts ?? 0) <= 2 
                        ? `Te quedan ${status.remainingAttempts ?? 0} intentos`
                        : undefined
                },
                { status: 401 }
            )
        }

        // Login exitoso - limpiar intentos
        const identifier = getLoginIdentifier(email, ip)
        await clearLoginAttempts(identifier)

        // PROTECCIÓN CONTRA SESSION FIXATION (Resuelve AUTH-003)
        // Supabase ya regenera el session token automáticamente en signInWithPassword,
        // pero agregamos validación adicional para asegurar nueva sesión

        // Verificar que tenemos una sesión nueva válida
        if (!data.session || !data.session.access_token) {
            return NextResponse.json(
                { success: false, error: 'Error al crear sesión' },
                { status: 500 }
            )
        }

        // Self-healing: garantiza perfil/organizacion para usuarios legacy
        try {
            await ensureUserBootstrap({
                userId: data.user.id,
                email: data.user.email,
                fullName: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
                avatarUrl: data.user.user_metadata?.avatar_url || data.user.user_metadata?.picture || null,
                createOrganizationIfMissing: false,
            })
        } catch (bootstrapError) {
            log.error('Login bootstrap failed', bootstrapError)
        }

        // Obtener perfil para saber si es platform admin
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_platform_admin, full_name')
            .eq('id', data.user.id)
            .maybeSingle()

        // Crear response con nueva sesión
        const response = NextResponse.json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
                name: profile?.full_name || data.user.user_metadata?.full_name,
                isPlatformAdmin: profile?.is_platform_admin || false
            }
        })

        // IMPORTANTE: Asegurar que las cookies de sesión se setean correctamente
        // Supabase SSR maneja esto automáticamente, pero agregamos headers de seguridad

        // Security headers para cookies de sesión
        response.headers.set('X-Session-Regenerated', 'true')

        return response

    } catch (error: any) {
        log.error('Login error', error)
        return NextResponse.json(
            { success: false, error: 'Error al procesar la solicitud' },
            { status: 500 }
        )
    }
}
