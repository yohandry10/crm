/**
 * Cliente de Supabase para Server Components y Route Handlers
 * Usa @supabase/ssr (el paquete oficial recomendado)
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Crea cliente de Supabase para Server Components
 * Lee las cookies automáticamente para mantener la sesión
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
    const cookieStore = await cookies()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Faltan variables de entorno de Supabase. ' +
            'Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY'
        )
    }

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        cookieStore.set(name, value, options)
                    )
                } catch {
                    // Ignorar en Server Components (solo lectura)
                }
            },
        },
    })
}

/**
 * Crea cliente de Supabase para Route Handlers
 * Puede leer Y escribir cookies
 */
export async function createSupabaseRouteHandler(): Promise<SupabaseClient> {
    const cookieStore = await cookies()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Faltan variables de entorno de Supabase. ' +
            'Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY'
        )
    }

    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                )
            },
        },
    })
}
