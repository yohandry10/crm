"use client"

import { useState, useEffect } from "react"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check, Loader2, CreditCard, Zap } from "lucide-react"
import { toast } from "sonner"

interface Plan {
  id: string
  name: string
  display_name: string
  description: string
  price_monthly: number
  price_yearly: number
  max_users: number
  max_contacts: number
  features: string[]
}

interface SubscriptionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  isExpired?: boolean
}

export function SubscriptionModal({ open, onOpenChange, organizationId, isExpired }: SubscriptionModalProps) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [isYearly, setIsYearly] = useState(false)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (open) {
      loadPlans()
    }
  }, [open])

  const loadPlans = async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .neq("name", "trial")
        .order("sort_order")

      if (data) {
        setPlans(data.map(p => ({
          ...p,
          features: typeof p.features === "string" ? JSON.parse(p.features) : p.features || []
        })))
      }
    } catch (error) {
      console.error("Error loading plans:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      toast.error("Selecciona un plan")
      return
    }

    setProcessing(true)
    try {
      const res = await fetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          plan: selectedPlan,
          billingPeriod: isYearly ? "yearly" : "monthly",
        }),
      })

      const json = await res.json()
      
      if (json.success) {
        if (json.checkoutUrl) {
          // Redirect to payment gateway
          window.location.href = json.checkoutUrl
        } else if (json.pendingPayment) {
          toast.info(json.message || "Solicitud registrada. El pago queda pendiente de confirmación.")
          onOpenChange(false)
        } else {
          toast.success("¡Suscripción activada!")
          onOpenChange(false)
          window.location.reload()
        }
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al procesar")
    } finally {
      setProcessing(false)
    }
  }

  const formatPrice = (price: number) => {
    return `S/ ${price.toLocaleString()}`
  }

  const getYearlySavings = (monthly: number, yearly: number) => {
    const monthlyTotal = monthly * 12
    const savings = monthlyTotal - yearly
    return Math.round((savings / monthlyTotal) * 100)
  }

  return (
    <Dialog open={open} onOpenChange={isExpired ? undefined : onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {isExpired ? "Tu prueba ha expirado" : "Elige tu Plan"}
          </DialogTitle>
          <DialogDescription>
            {isExpired 
              ? "Suscríbete para continuar usando todas las funciones del CRM"
              : "Selecciona el plan que mejor se adapte a tu negocio"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3 py-4">
          <Label className={!isYearly ? "font-semibold" : "text-muted-foreground"}>Mensual</Label>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <Label className={isYearly ? "font-semibold" : "text-muted-foreground"}>
            Anual
            <Badge className="ml-2 bg-green-100 text-green-800">2 meses gratis</Badge>
          </Label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => {
              const price = isYearly ? plan.price_yearly : plan.price_monthly
              const isSelected = selectedPlan === plan.name
              const isPopular = plan.name === "professional"

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border-2 p-6 cursor-pointer transition-all ${
                    isSelected 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedPlan(plan.name)}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Más Popular
                    </Badge>
                  )}

                  <div className="text-center mb-4">
                    <h3 className="font-bold text-lg">{plan.display_name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">{formatPrice(price)}</span>
                    <span className="text-muted-foreground">/{isYearly ? "año" : "mes"}</span>
                    {isYearly && (
                      <p className="text-sm text-green-600 mt-1">
                        Ahorras {getYearlySavings(plan.price_monthly, plan.price_yearly)}%
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    variant={isSelected ? "default" : "outline"}
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedPlan(plan.name)
                    }}
                  >
                    {isSelected ? "Seleccionado" : "Seleccionar"}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Subscribe Button */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {!isExpired && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          )}
          <Button
            onClick={handleSubscribe}
            disabled={!selectedPlan || processing}
            className="gap-2"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Suscribirse Ahora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
