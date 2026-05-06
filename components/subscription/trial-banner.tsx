"use client"

import { useState } from "react"
import { AlertTriangle, Clock, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SubscriptionModal } from "./subscription-modal"
import { useSubscription } from "@/hooks/use-subscription"
import { useAuth } from "@/components/providers/auth-provider"

export function TrialBanner() {
  const { organizationId, profile } = useAuth()
  const { subscription, shouldShowBanner, isExpired, isTrial, dismissBanner } = useSubscription()
  const [showModal, setShowModal] = useState(false)

  // Use useEffect to handle side effects like showing modal if needed, 
  // but avoid logic in render.
  // The hook handles visibility logic.

  if (profile?.is_platform_admin || !shouldShowBanner || !subscription) return null

  const daysRemaining = subscription.daysRemaining
  const isTrialEnding = isTrial && daysRemaining <= 1

  return (
    <>
      <div className={`px-4 py-2 flex items-center justify-between ${isExpired ? "bg-red-500 text-white" :
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
              `¡Tu prueba termina ${daysRemaining === 0 ? "hoy" : "mañana"}! Suscríbete ahora.`
            ) : (
              `Período de prueba: ${daysRemaining} días restantes`
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
              onClick={dismissBanner}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <SubscriptionModal
        open={showModal}
        onOpenChange={setShowModal}
        organizationId={organizationId || ""}
        isExpired={isExpired}
      />
    </>
  )
}
