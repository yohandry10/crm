"use client"

/**
 * Sistema de caché simple para datos de usuario
 * Evita múltiples llamadas a la base de datos para la misma información
 */

interface UserProfile {
  email: string
  full_name?: string | null
  role: string
  initials: string
  organization_id?: string | null
}

interface CacheEntry {
  data: UserProfile
  timestamp: number
}

class UserCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly TTL = 5 * 60 * 1000 // 5 minutos

  /**
   * Obtiene datos del usuario desde el caché
   */
  get(userId: string): UserProfile | null {
    const entry = this.cache.get(userId)

    if (!entry) return null

    // Verificar si el caché expiró
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(userId)
      return null
    }

    return entry.data
  }

  /**
   * Guarda datos del usuario en el caché
   */
  set(userId: string, data: UserProfile): void {
    this.cache.set(userId, {
      data,
      timestamp: Date.now()
    })
  }

  /**
   * Limpia el caché de un usuario específico
   */
  invalidate(userId: string): void {
    this.cache.delete(userId)
  }

  /**
   * Limpia todo el caché
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Limpia entradas expiradas del caché
   */
  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL) {
        this.cache.delete(key)
      }
    }
  }
}

// Instancia singleton del caché
const userCache = new UserCache()

// Limpieza automática cada 5 minutos
if (typeof window !== 'undefined') {
  setInterval(() => {
    userCache.cleanup()
  }, 5 * 60 * 1000)
}

export { userCache, type UserProfile }

/**
 * Hook para obtener datos de usuario con caché
 */
import { useState, useEffect } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

export function useUserProfile(supabase: SupabaseClient | null) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    const supabaseClient = supabase

    let isMounted = true

    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabaseClient.auth.getUser()

        if (!isMounted || !authUser) {
          if (isMounted) setLoading(false)
          return
        }

        // Verificar caché primero
        const cachedUser = userCache.get(authUser.id)
        if (cachedUser) {
          setUser(cachedUser)
          setLoading(false)
          return
        }

        // Si no está en caché, obtener de la base de datos
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('full_name, current_organization_id')
          .eq('id', authUser.id)
          .single()

        if (!isMounted) return

        let role = 'member'
        if (profile?.current_organization_id) {
          const { data: membership } = await supabaseClient
            .from('organization_members')
            .select('role')
            .eq('user_id', authUser.id)
            .eq('organization_id', profile.current_organization_id)
            .single()

          if (membership?.role) {
            role = membership.role
          }
        }

        if (!isMounted) return

        const userProfile: UserProfile = {
          email: authUser.email || '',
          full_name: profile?.full_name,
          role,
          initials: authUser.email?.substring(0, 2).toUpperCase() || 'U',
          organization_id: profile?.current_organization_id
        }

        // Guardar en caché
        userCache.set(authUser.id, userProfile)
        setUser(userProfile)
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Failed to load user'))
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      isMounted = false
    }
  }, [supabase])

  return { user, loading, error }
}
