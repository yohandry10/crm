import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { csrfMiddleware } from './middleware-csrf'

// ====================================================================
// CORS CONFIGURATION (Resuelve SEC-001)
// ====================================================================

/**
 * Obtiene lista de orígenes permitidos según el entorno
 */
function getAllowedOrigins(): string[] {
    const isDev = process.env.NODE_ENV === 'development'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (isDev ? 'http://localhost:3000' : '')

    // En desarrollo: localhost + URLs configuradas
    if (isDev) {
        return [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://127.0.0.1:3000',
            appUrl,
        ]
    }

    // En producción: SOLO URLs explícitamente configuradas
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []

    // Siempre incluir la URL de la app
    if (appUrl && !allowedOrigins.includes(appUrl)) {
        allowedOrigins.push(appUrl)
    }

    return allowedOrigins
}

/**
 * Maneja CORS y retorna headers apropiados
 * Retorna NextResponse si debe terminar (OPTIONS o blocked), null si debe continuar
 */
function handleCORS(request: NextRequest, origin: string | null): NextResponse | null {
    const pathname = request.nextUrl.pathname
    const method = request.method
    const hostOrigin = request.nextUrl.origin

    // Rutas que permiten CORS más permisivo (APIs públicas embebibles)
    const publicCORSRoutes = [
        '/api/webhooks', // Webhooks externos (Stripe, N8N, etc.)
        '/f/', // Formularios embebibles
        '/api/public', // APIs públicas
        '/api/pay', // Links de pago embebibles
    ]

    const isPublicCORS = publicCORSRoutes.some(route => pathname.startsWith(route))
    const allowedOrigins = getAllowedOrigins()

    // Si es OPTIONS (preflight), responder inmediatamente
    if (method === 'OPTIONS') {
        // Permitir OPTIONS para rutas públicas desde cualquier origen
        if (isPublicCORS) {
            const response = new NextResponse(null, { status: 204 })
            response.headers.set('Access-Control-Allow-Origin', origin || '*')
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key')
            response.headers.set('Access-Control-Max-Age', '86400') // 24 horas
            return response
        }

        // Para otras rutas, validar origen
        if (origin && allowedOrigins.includes(origin)) {
            const response = new NextResponse(null, { status: 204 })
            response.headers.set('Access-Control-Allow-Origin', origin)
            response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
            response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Idempotency-Key')
            response.headers.set('Access-Control-Allow-Credentials', 'true')
            response.headers.set('Access-Control-Max-Age', '86400')
            return response
        }

        // Origen no permitido
        return NextResponse.json(
            { success: false, error: 'CORS policy: Origin not allowed' },
            { status: 403 }
        )
    }

    // Para requests regulares, validar origen si no es público
    // ✅ Siempre permitir same-origin
    if (!isPublicCORS && origin && origin !== hostOrigin && !allowedOrigins.includes(origin)) {
        console.warn(`🚫 CORS blocked: Origin ${origin} not in allowed list for ${pathname}`)
        return NextResponse.json(
            { success: false, error: 'CORS policy: Origin not allowed' },
            { status: 403 }
        )
    }

    return null // OK, continuar (headers se agregan después)
}

// Rutas públicas que no requieren autenticación
const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/pricing',
    '/f', // Formularios públicos embebibles
    '/api/health',
    '/api/webhooks',
    '/api/public',
    '/api/auth', // Login, cambio de contraseña
    '/auth/callback',
    '/api/invitations',
]

// Rutas de API que requieren autenticación
const protectedApiRoutes = [
    '/api/contacts',
    '/api/invoices',
    '/api/payments',
    '/api/workflows',
    '/api/products',
    '/api/campaigns',
    '/api/settings',
    '/api/activities',
    '/api/notifications',
    '/api/comprobantes',
    '/api/opportunities',
    '/api/quotes',
    '/api/tasks',
    '/api/events',
    '/api/integrations',
    '/api/inventory',
    '/api/dashboard',
    '/api/analytics',
    '/api/accounts',
    '/api/tickets',
    '/api/orders',
    '/api/admin',
    '/api/onboarding',
    '/api/subscriptions',
    '/api/forms', // Gestión de formularios (protegido)
    '/api/reports',
]

// Rutas que requieren Super Admin
const adminRoutes = ['/admin']

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname
    const method = request.method
    const origin = request.headers.get('origin')

    // ====================================================================
    // 1. CORS HANDLING (Resuelve SEC-001)
    // ====================================================================
    const corsResponse = handleCORS(request, origin)
    if (corsResponse) return corsResponse

    // ====================================================================
    // 2. CONTENT-TYPE VALIDATION (Resuelve SEC-002)
    // ====================================================================
    // Validar Content-Type en métodos POST/PUT/PATCH para rutas API
    if (['POST', 'PUT', 'PATCH'].includes(method) && pathname.startsWith('/api/')) {
        // Excepciones: webhooks y multipart uploads
        const skipContentTypeValidation = [
            '/api/webhooks/', // Webhooks pueden usar diferentes Content-Types
            '/api/payments/stripe/webhook', // Stripe usa application/json pero lo maneja especialmente
        ]

        const shouldValidate = !skipContentTypeValidation.some(route => pathname.startsWith(route))

        if (shouldValidate) {
            const contentType = request.headers.get('content-type')

            // Si no tiene Content-Type, rechazar
            if (!contentType) {
                return NextResponse.json(
                    {
                        success: false,
                        error: 'Content-Type header is required',
                        details: 'Expected: application/json for API requests'
                    },
                    { status: 415 }
                )
            }

            // Validar que sea application/json (permitir charset)
            if (!contentType.toLowerCase().includes('application/json')) {
                // Permitir multipart/form-data solo para rutas específicas de upload
                const allowsFormData = [
                    '/api/contacts/import',
                    '/api/products/import',
                    '/api/documents/upload',
                ]

                if (allowsFormData.some(route => pathname.startsWith(route)) &&
                    contentType.toLowerCase().includes('multipart/form-data')) {
                    // Permitir multipart/form-data para estas rutas
                } else {
                    return NextResponse.json(
                        {
                            success: false,
                            error: 'Invalid Content-Type',
                            details: `Expected application/json, received: ${contentType}`
                        },
                        { status: 415 }
                    )
                }
            }
        }
    }

    // 🔒 Cron jobs protegidos por secreto
    if (pathname.startsWith('/api/cron')) {
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret) {
            return NextResponse.json({ success: false, error: 'Cron secret not configured' }, { status: 500 })
        }
        const provided = request.headers.get('x-cron-secret')
        if (provided !== cronSecret) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
        }
        return NextResponse.next()
    }

    // ✅ Permitir webhooks públicos específicos (incluyendo N8N)
    if (pathname.startsWith('/api/payments/stripe/webhook') ||
        pathname.startsWith('/api/webhooks/stripe') ||
        pathname.startsWith('/api/webhooks/n8n')) {
        return NextResponse.next()
    }

    // CSRF token fuerte (se complementa con Origin)
    const csrfCheck = csrfMiddleware(request)
    if (csrfCheck) return csrfCheck

    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Verificar variables de entorno
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        console.error('❌ Supabase env vars not configured')
        // Permitir rutas públicas sin auth
        if (publicRoutes.some(route => pathname.startsWith(route))) {
            return response
        }
        // Redirigir a login para otras rutas
        if (!pathname.startsWith('/api/')) {
            return NextResponse.redirect(new URL('/login', request.url))
        }
        return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) =>
                    request.cookies.set(name, value)
                )
                response = NextResponse.next({
                    request: {
                        headers: request.headers,
                    },
                })
                cookiesToSet.forEach(({ name, value, options }) =>
                    response.cookies.set(name, value, options)
                )
            },
        },
    })

    // Verificar sesión usando getUser (más seguro que getSession)
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    // Rutas públicas - permitir acceso
    if (publicRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
        // Si está logueado y va a login/signup, redirigir según tipo de usuario
        if (user && (pathname === '/login' || pathname === '/signup')) {
            // Verificar si es platform admin
            const { data: profile } = await supabase
                .from('profiles')
                .select('is_platform_admin')
                .eq('id', user.id)
                .single()

            if (profile?.is_platform_admin) {
                return NextResponse.redirect(new URL('/admin', request.url))
            }
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
        return response
    }

    // Rutas de API protegidas
    if (protectedApiRoutes.some(route => pathname.startsWith(route))) {
        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }
        return response
    }

    // Rutas de páginas protegidas
    if (!user) {
        const redirectUrl = new URL('/login', request.url)
        redirectUrl.searchParams.set('redirect', pathname)
        return NextResponse.redirect(redirectUrl)
    }

    // Rutas de Admin - verificar is_platform_admin
    if (adminRoutes.some(route => pathname.startsWith(route))) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_platform_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_platform_admin) {
            return NextResponse.redirect(new URL('/dashboard', request.url))
        }
    }

    // Verificar onboarding completado (excepto para /onboarding y /admin)
    if (!pathname.startsWith('/onboarding') && !pathname.startsWith('/admin')) {
        const { data: membership } = await supabase
            .from('organization_members')
            .select('organization_id, organizations(onboarding_completed)')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .limit(1)
            .single()

        if (membership) {
            const org = membership.organizations as any
            if (org && org.onboarding_completed === false) {
                return NextResponse.redirect(new URL('/onboarding', request.url))
            }
        }
    }

    // ====================================================================
    // 2. AGREGAR CORS HEADERS A RESPUESTAS (Resuelve SEC-001)
    // ====================================================================
    const publicCORSRoutes = [
        '/api/webhooks',
        '/f/',
        '/api/public',
        '/api/pay',
    ]
    const isPublicCORS = publicCORSRoutes.some(route => pathname.startsWith(route))
    const allowedOrigins = getAllowedOrigins()

    if (isPublicCORS) {
        // Rutas públicas: permitir origen solicitante o wildcard
        response.headers.set('Access-Control-Allow-Origin', origin || '*')
        if (origin) {
            response.headers.set('Access-Control-Allow-Credentials', 'true')
        }
    } else if (origin && allowedOrigins.includes(origin)) {
        // Rutas protegidas: solo orígenes en whitelist
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    // Security headers (defensa básica: clickjacking, sniffing, referrer, HSTS)
    response.headers.set('X-Frame-Options', 'SAMEORIGIN')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    // Aplica HSTS sólo si estás sirviendo por HTTPS; en Vercel/producción suele ser seguro
    if (request.nextUrl.protocol === 'https:') {
        response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
    }

    // CSRF defensa básica: para métodos sensibles, validar origen
    // ✅ Excluir webhooks de la validación de origen
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) &&
        !pathname.startsWith('/api/webhooks/') &&
        !pathname.startsWith('/api/invitations')) {
        const host = request.nextUrl.origin
        if (origin && origin !== host) {
            return NextResponse.json({ success: false, error: 'CSRF protection: invalid origin' }, { status: 403 })
        }
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|public|.*\\..*$).*)',
    ],
}
