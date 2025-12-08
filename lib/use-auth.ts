import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { User, SupabaseClient } from '@supabase/supabase-js'

interface UseAuthReturn {
    user: User | null
    role: string | null
    loading: boolean
    error: Error | null
    signOut: () => Promise<void>
}

/**
 * Hook para manejar autenticación en componentes cliente
 * Usa @supabase/ssr en lugar del paquete deprecado
 */
export function useAuth(options?: { requireAuth?: boolean; redirectTo?: string }): UseAuthReturn {
    const [user, setUser] = useState<User | null>(null)
    const [role, setRole] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<Error | null>(null)
    const supabaseRef = useRef<SupabaseClient | null>(null)
    const router = useRouter()

    const requireAuth = options?.requireAuth ?? false
    const redirectTo = options?.redirectTo ?? '/login'

    useEffect(() => {
        let mounted = true

        const initAuth = async () => {
            try {
                // Importar dinámicamente para evitar problemas de SSR
                const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser')
                const supabase = getSupabaseBrowserClient()
                supabaseRef.current = supabase

                // Obtener sesión inicial
                const { data: { session }, error: sessionError } = await supabase.auth.getSession()

                if (sessionError) throw sessionError

                if (!mounted) return

                if (session?.user) {
                    setUser(session.user)
                    const userRole = session.user.user_metadata?.role || null
                    setRole(userRole)
                } else {
                    setUser(null)
                    setRole(null)

                    if (requireAuth) {
                        router.push(redirectTo)
                    }
                }

                // Suscribirse a cambios de autenticación
                const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                    if (!mounted) return
                    
                    if (session?.user) {
                        setUser(session.user)
                        const userRole = session.user.user_metadata?.role || null
                        setRole(userRole)
                    } else {
                        setUser(null)
                        setRole(null)

                        if (requireAuth) {
                            router.push(redirectTo)
                        }
                    }
                })

                return () => {
                    subscription.unsubscribe()
                }
            } catch (err) {
                if (mounted) {
                    setError(err as Error)
                    console.error('Error initializing auth:', err)
                }
            } finally {
                if (mounted) {
                    setLoading(false)
                }
            }
        }

        initAuth()

        return () => {
            mounted = false
        }
    }, [router, requireAuth, redirectTo])

    const signOut = async () => {
        try {
            const supabase = supabaseRef.current
            if (!supabase) {
                const { getSupabaseBrowserClient } = await import('@/lib/supabase-browser')
                supabaseRef.current = getSupabaseBrowserClient()
            }
            
            await supabaseRef.current!.auth.signOut()
            router.push('/login')
        } catch (err) {
            console.error('Error signing out:', err)
            throw err
        }
    }

    return {
        user,
        role,
        loading,
        error,
        signOut
    }
}
