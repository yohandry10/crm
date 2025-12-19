"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import type { User } from "@supabase/supabase-js"

interface UserProfile {
  id: string
  email: string
  full_name?: string | null
  current_organization_id?: string | null
  role: string
  initials: string
}

interface AuthContextValue {
  user: User | null
  profile: UserProfile | null
  organizationId: string | null
  loading: boolean
  error: Error | null
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const loadUserData = async () => {
    try {
      setLoading(true)
      const supabase = getSupabaseBrowserClient()

      // 1. Get authenticated user
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        const errorCode = (authError as any)?.code
        const errorName = (authError as any)?.name
        if (errorCode === "refresh_token_not_found" || errorName === "AuthSessionMissingError") {
          // Session is missing/expired; treat as logged out without noisy errors.
          setUser(null)
          setProfile(null)
          setOrganizationId(null)
          setLoading(false)
          return
        }
        throw authError
      }

      if (!authUser) {
        setUser(null)
        setProfile(null)
        setOrganizationId(null)
        setLoading(false)
        return
      }

      setUser(authUser)

      // 2. Get profile and organization in parallel
      const [profileResult, membershipResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, current_organization_id")
          .eq("id", authUser.id)
          .single(),
        supabase
          .from("organization_members")
          .select("role, organization_id")
          .eq("user_id", authUser.id)
          .eq("is_active", true)
          .limit(1)
          .single()
      ])

      const profileData = profileResult.data
      const membership = membershipResult.data

      // 3. Determine organization ID
      const orgId = profileData?.current_organization_id || membership?.organization_id || null
      setOrganizationId(orgId)

      // 4. Build user profile
      const userProfile: UserProfile = {
        id: authUser.id,
        email: authUser.email || "",
        full_name: profileData?.full_name,
        current_organization_id: orgId,
        role: membership?.role || "member",
        initials: (authUser.email?.substring(0, 2) || "U").toUpperCase()
      }

      setProfile(userProfile)
      setError(null)
    } catch (err) {
      console.error("Error loading user data:", err)
      setError(err instanceof Error ? err : new Error("Unknown error"))
    } finally {
      setLoading(false)
    }
  }

  // Load user data on mount
  useEffect(() => {
    loadUserData()
  }, [])

  // Subscribe to auth state changes
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserData()
      } else {
        setUser(null)
        setProfile(null)
        setOrganizationId(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    user,
    profile,
    organizationId,
    loading,
    error,
    refreshProfile: loadUserData
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
