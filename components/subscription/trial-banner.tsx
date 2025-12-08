"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { AlertTriangle, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SubscriptionModal } from "./subscription-modal"

interface TrialBannerProps {
  organizationId: string
}

export function TrialBanner({ organizationId }: TrialBannerProps) {
  const [status, setStatus] = useState<{
    isActive: boolean
    status: string
    daysRemaining: number
    plan: string
  } | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    checkSubscription()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const checkSubscription = async () => {
    try {
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

        // Auto-show modal if expired
        if (!data[0].is_active && data[0].status === "expired") {
          setShowModal(true)
        }
      }
    } catch (error) {
      console.error("Error checking subscription:", error)
    }
  }

  if (!status || dismissed) return null

  // Don't show banner for active subscriptions
  if (status.status === "active") return null

  const isExpired = status.status === "expired"
  const isTrialEnding = status.status === "trial" && status.daysRemaining <= 1

  return (
    <>
      <div className={`px-4 py-2 flex items-center justify-between ${
        isExpired ? "bg-red-500 text-white" :
        isTrialEnding ? "bg-yellow-500 text-yellow-900" :
        "bg-blue-500 text-white"
      }`}>
        <div className="flex items-center gap-2">
          {isExpired ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <Clock className="w-4 h-4" />
          )}
          <span className="text-sm font-medium">
            {isExpired ? (
              "Tu período de prueba ha expirado. Suscríbete para continuar usando el CRM."
            ) : isTrialEnding ? (
              `¡Tu prueba termina ${status.daysRemaining === 0 ? "hoy" : "mañana"}! Suscríbete ahora.`
            ) : (
              `Período de prueba: ${status.daysRemaining} días restantes`
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={isExpired ? "secondary" : "outline"}
            className={isExpired ? "" : "bg-white/20 border-white/30 hover:bg-white/30"}
            onClick={() => setShowModal(true)}
          >
            Ver Planes
          </Button>
          {!isExpired && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 hover:bg-white/20"
              onClick={() => setDismissed(true)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <SubscriptionModal
        open={showModal}
        onOpenChange={setShowModal}
        organizationId={organizationId}
        isExpired={isExpired}
      />
    </>
  )
}
