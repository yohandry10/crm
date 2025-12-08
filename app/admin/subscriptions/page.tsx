"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, CreditCard, Loader2, CheckCircle } from "lucide-react"
import { toast } from "sonner"

interface Subscription {
  id: string
  organization_id: string
  organization_name: string
  plan: string
  status: string
  amount: number
  billing_period: string
  started_at: string
  ended_at: string | null
}

interface Plan {
  id: string
  name: string
  display_name: string
  price_monthly: number
  price_yearly: number
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activateDialog, setActivateDialog] = useState<{ open: boolean; orgId: string; orgName: string }>({
    open: false, orgId: "", orgName: ""
  })
  const [activating, setActivating] = useState(false)
  const [activateForm, setActivateForm] = useState({
    plan: "starter",
    billingPeriod: "monthly",
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [subsRes, plansRes] = await Promise.all([
        fetch("/api/admin/subscriptions"),
        fetch("/api/admin/plans"),
      ])
      
      const subsJson = await subsRes.json()
      const plansJson = await plansRes.json()
      
      if (subsJson.success) setSubscriptions(subsJson.data)
      if (plansJson.success) setPlans(plansJson.data)
    } catch {
      toast.error("Error al cargar datos")
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setActivating(true)
    try {
      const res = await fetch("/api/admin/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: activateDialog.orgId,
          plan: activateForm.plan,
          billingPeriod: activateForm.billingPeriod,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Suscripción activada")
        setActivateDialog({ open: false, orgId: "", orgName: "" })
        loadData()
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al activar")
    } finally {
      setActivating(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
      trial: "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400",
      expired: "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400",
      cancelled: "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400",
    }
    return styles[status] || "bg-gray-100 dark:bg-gray-500/20 text-gray-700 dark:text-gray-400"
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-PE")
  }

  const formatCurrency = (amount: number) => {
    return `S/ ${amount.toLocaleString()}`
  }

  const selectedPlan = plans.find(p => p.name === activateForm.plan)
  const price = selectedPlan 
    ? (activateForm.billingPeriod === "yearly" ? selectedPlan.price_yearly : selectedPlan.price_monthly)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white tracking-tight">Suscripciones</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona las suscripciones de todas las organizaciones</p>
      </div>

      {/* Plans Overview */}
      <div className="grid gap-4 md:grid-cols-4">
        {plans.filter(p => p.name !== 'trial').map((plan) => (
          <div key={plan.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-cyan-500" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">{plan.display_name}</span>
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">S/ {plan.price_monthly}</div>
            <p className="text-xs text-gray-500">por mes</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
              S/ {plan.price_yearly}/año
            </p>
          </div>
        ))}
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Historial de Suscripciones</h3>
            <p className="text-xs text-gray-500 mt-0.5">Todas las suscripciones activas e históricas</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-500" />
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Organización</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Plan</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Estado</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Monto</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Período</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Inicio</th>
                  <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500 text-sm">
                      No hay suscripciones registradas
                    </td>
                  </tr>
                ) : (
                  subscriptions
                    .filter(s => s.organization_name?.toLowerCase().includes(search.toLowerCase()))
                    .map((sub) => (
                      <tr key={sub.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-medium text-gray-900 dark:text-white">{sub.organization_name}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400">
                            {sub.plan}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-medium ${getStatusBadge(sub.status)}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700 dark:text-gray-300">{formatCurrency(sub.amount || 0)}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{sub.billing_period || "-"}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(sub.started_at)}</td>
                        <td className="px-5 py-4 text-sm text-gray-600 dark:text-gray-400">{formatDate(sub.ended_at)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Activate Subscription Dialog */}
      <Dialog open={activateDialog.open} onOpenChange={(open) => setActivateDialog(prev => ({ ...prev, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Activar Suscripción</DialogTitle>
            <DialogDescription>
              Activar suscripción para {activateDialog.orgName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={activateForm.plan}
                onValueChange={(v) => setActivateForm(prev => ({ ...prev, plan: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter(p => p.name !== 'trial').map((plan) => (
                    <SelectItem key={plan.id} value={plan.name}>
                      {plan.display_name} - S/ {plan.price_monthly}/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Período de Facturación</Label>
              <Select
                value={activateForm.billingPeriod}
                onValueChange={(v) => setActivateForm(prev => ({ ...prev, billingPeriod: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="yearly">Anual (2 meses gratis)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500">Total a cobrar:</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(price)}</p>
              <p className="text-xs text-gray-500">
                {activateForm.billingPeriod === "yearly" ? "por año" : "por mes"}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActivateDialog({ open: false, orgId: "", orgName: "" })}>
              Cancelar
            </Button>
            <Button onClick={handleActivate} disabled={activating} className="gap-2">
              {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Activar Suscripción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
