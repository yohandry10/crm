/**
 * Cliente de Supabase para componentes del navegador
 * Usa @supabase/ssr (el paquete oficial recomendado)
 */
import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

/**
 * Obtiene el cliente de Supabase para uso en componentes del navegador
 * Singleton para evitar múltiples instancias
 * IMPORTANTE: Solo llamar desde el cliente (useEffect, event handlers)
 */
export function getSupabaseBrowserClient(): SupabaseClient {
    // Verificar que estamos en el cliente
    if (typeof window === 'undefined') {
        throw new Error(
            'getSupabaseBrowserClient() solo puede ser llamado en el cliente. ' +
            'Usa useEffect o un event handler.'
        )
    }

    if (browserClient) {
        return browserClient
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error(
            'Faltan variables de entorno de Supabase. ' +
            'Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local'
        )
    }

    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            flowType: 'implicit',
            detectSessionInUrl: true,
        },
    })
    return browserClient
}

/**
 * Hook-friendly: Obtiene el cliente de forma segura
 * Retorna null si no está disponible (SSR)
 */
export function getSupabaseBrowserClientSafe(): SupabaseClient | null {
    if (typeof window === 'undefined') {
        return null
    }
    
    try {
        return getSupabaseBrowserClient()
    } catch {
        return null
    }
}
