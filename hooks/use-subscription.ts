"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { useAuth } from "@/components/providers/auth-provider"

const TRIAL_BANNER_DISMISSED_KEY = "zion_trial_banner_dismissed_v1"

export interface SubscriptionStatus {
    isActive: boolean
    status: string
    daysRemaining: number
    plan: string
}

export function useSubscription() {
    const { organizationId, profile } = useAuth()
    const [status, setStatus] = useState<SubscriptionStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [isDismissed, setIsDismissed] = useState(false)

    // Load dismissed state on mount
    useEffect(() => {
        const dismissed = localStorage.getItem(TRIAL_BANNER_DISMISSED_KEY)
        if (dismissed) {
            // Optional: Check if dismissal is old? For now, just permanent dismissal per user/browser as requested.
            // User said "quitar eso azul", implying they want it gone.
            setIsDismissed(true)
        }
    }, [])

    // Fetch subscription status
    useEffect(() => {
        if (profile?.is_platform_admin || !organizationId) {
            setStatus(null)
            setLoading(false)
            return
        }

        const checkSubscription = async () => {
            try {
                setLoading(true)
                const supabase = getSupabaseBrowserClient()
                const { data } = await supabase.rpc("check_subscription_status", {
                    p_organization_id: organizationId,
                })

                if (data && data[0]) {
                    setStatus({
                        isActive: data[0].is_active,
                        status: data[0].status,
                        daysRemaining: data[0].days_remaining,
                        plan: data[0].plan,
                    })
                }
            } catch (error) {
                console.error("Error checking subscription:", error)
            } finally {
                setLoading(false)
            }
        }

        checkSubscription()
    }, [organizationId, profile?.is_platform_admin])

    const dismissBanner = () => {
        setIsDismissed(true)
        localStorage.setItem(TRIAL_BANNER_DISMISSED_KEY, "true")
    }

    // Derived state
    const isExpired = status?.status === "expired"
    const isTrial = status?.status === "trial"
    // Show banner if:
    // 1. We have status
    // 2. Not dismissed AND (Trial OR Expired)
    // 3. If expired, maybe force show? User said "quitar eso azul", usually strictly referring to trial banner.
    // We will allow dismissing expired warning too if it's annoying, or maybe strictly trial.
    // The original component allowed dismissing non-expired.
    const shouldShowBanner = !profile?.is_platform_admin && status && !isDismissed && (status.status !== 'active')

    // Header badge specific: Show if trial active, regardless of dismissal (usually badges are persistent indicators, but small)
    const shouldShowBadge = !profile?.is_platform_admin && status && isTrial

    return {
        subscription: status,
        loading,
        isDismissed,
        dismissBanner,
        shouldShowBanner,
        shouldShowBadge,
        isExpired,
        isTrial
    }
}
