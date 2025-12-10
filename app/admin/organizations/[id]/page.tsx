"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  ArrowLeft, Building2, CreditCard, Activity, Loader2, CheckCircle
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface Organization {
  id: string
  name: string
  slug: string
  ruc: string | null
  subscription_status: string
  subscription_plan: string
  trial_ends_at: string | null
  subscription_ends_at: string | null
  onboarding_completed: boolean
  created_at: string
  max_users: number
  max_contacts: number
}

interface Member {
  id: string
  user_id: string
  role: string
  created_at: string
  profiles: { email: string; full_name: string | null }
}

interface SubscriptionHistory {
  id: string
  plan: string
  status: string
  amount: number
  billing_period: string
  started_at: string
  ended_at: string | null
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [history, setHistory] = useState<SubscriptionHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [activating, setActivating] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState("starter")
  const [billingPeriod, setBillingPeriod] = useState("monthly")
  const [paymentReference, setPaymentReference] = useState("")
  const [activeTab, setActiveTab] = useState("overview")

  const orgId = params?.id as string

  useEffect(() => {
    if (orgId) loadOrganization()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId])

  const loadOrganization = async () => {
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}`)
      const json = await res.json()
      if (json.success) {
        setOrganization(json.data.organization)
        setMembers(json.data.members || [])
        setHistory(json.data.subscriptionHistory || [])
      }
    } catch {
      toast.error("Error al cargar organización")
    } finally {
      setLoading(false)
    }
  }

  const activateSubscription = async () => {
    setActivating(true)
    try {
      const res = await fetch("/api/admin/subscriptions/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          plan: selectedPlan,
          billingPeriod,
          paymentReference: paymentReference || undefined,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Suscripción activada")
        loadOrganization()
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
      active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
      trial: "bg-amber-500/15 text-amber-400 border-amber-500/20",
      expired: "bg-red-500/15 text-red-400 border-red-500/20",
      cancelled: "bg-slate-500/15 text-slate-400 border-slate-500/20",
    }
    return styles[status] || "bg-slate-500/15 text-slate-400 border-slate-500/20"
  }

  const formatDate = (date: string | null) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Organización no encontrada</p>
        <Link href="/admin/organizations">
          <Button variant="link" className="text-cyan-400">Volver a organizaciones</Button>
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: "overview", label: "General" },
    { id: "members", label: `Miembros (${members.length})` },
    { id: "subscription", label: "Suscripción" },
    { id: "history", label: "Historial" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/organizations">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">{organization.name}</h1>
          <p className="text-sm text-slate-500">{organization.slug}</p>
        </div>
        <span className={`inline-flex px-3 py-1.5 rounded-lg text-[12px] font-medium border ${getStatusBadge(organization.subscription_status)}`}>
          {organization.subscription_status}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Building2 className="w-5 h-5 text-blue-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">Información</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[13px] text-slate-500">RUC</span>
                <span className="text-[13px] font-medium text-slate-200">{organization.ruc || "-"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-slate-500">Creado</span>
                <span className="text-[13px] font-medium text-slate-200">{formatDate(organization.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-slate-500">Onboarding</span>
                <span className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium border ${organization.onboarding_completed ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' : 'bg-slate-500/15 text-slate-400 border-slate-500/20'}`}>
                  {organization.onboarding_completed ? "Completado" : "Pendiente"}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-violet-400" />
              <h3 className="text-[15px] font-semibold text-slate-100">Límites</h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-[13px] text-slate-500">Plan</span>
                <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  {organization.subscription_plan}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-slate-500">Máx. Usuarios</span>
                <span className="text-[13px] font-medium text-slate-200">{organization.max_users || 3}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[13px] text-slate-500">Máx. Contactos</span>
                <span className="text-[13px] font-medium text-slate-200">{organization.max_contacts || 500}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "members" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/[0.06]">
            <h3 className="text-[15px] font-semibold text-slate-100">Miembros de la Organización</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Usuario</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Rol</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Agregado</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-5 py-4">
                    <p className="font-medium text-[14px] text-slate-200">{member.profiles?.full_name || "Sin nombre"}</p>
                    <p className="text-[12px] text-slate-500">{member.profiles?.email}</p>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[11px] font-medium bg-white/[0.04] text-slate-400 border border-white/[0.06]">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[13px] text-slate-400">{formatDate(member.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "subscription" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-[15px] font-semibold text-slate-100">Gestionar Suscripción</h3>
              <p className="text-[12px] text-slate-500">Estado actual: {organization.subscription_status} - {organization.subscription_plan}</p>
            </div>
          </div>

          {organization.subscription_status === "trial" && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-[13px] text-amber-400">
                Trial expira: {formatDate(organization.trial_ends_at)}
              </p>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-slate-300">Plan</label>
              <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2332] border-white/[0.08]">
                  <SelectItem value="starter" className="text-slate-300 focus:bg-white/[0.06]">Starter - S/ 99/mes</SelectItem>
                  <SelectItem value="professional" className="text-slate-300 focus:bg-white/[0.06]">Professional - S/ 199/mes</SelectItem>
                  <SelectItem value="enterprise" className="text-slate-300 focus:bg-white/[0.06]">Enterprise - S/ 499/mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-[13px] font-medium text-slate-300">Período</label>
              <Select value={billingPeriod} onValueChange={setBillingPeriod}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1a2332] border-white/[0.08]">
                  <SelectItem value="monthly" className="text-slate-300 focus:bg-white/[0.06]">Mensual</SelectItem>
                  <SelectItem value="yearly" className="text-slate-300 focus:bg-white/[0.06]">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[13px] font-medium text-slate-300">Referencia de pago (opcional)</label>
            <Input
              placeholder="Ej: transferencia #123 o Yape/Plin"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-slate-200"
            />
          </div>

          <Button onClick={activateSubscription} disabled={activating} className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
            {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Activar/Actualizar Suscripción
          </Button>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/[0.06]">
            <h3 className="text-[15px] font-semibold text-slate-100">Historial de Suscripciones</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Plan</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Estado</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Monto</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Período</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Inicio</th>
                <th className="text-left text-[12px] font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Fin</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-[14px]">
                    Sin historial
                  </td>
                </tr>
              ) : (
                history.map((h) => (
                  <tr key={h.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="px-5 py-4 text-[13px] text-slate-200">{h.plan}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-lg text-[11px] font-medium border ${getStatusBadge(h.status)}`}>
                        {h.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] text-slate-300">S/ {h.amount || 0}</td>
                    <td className="px-5 py-4 text-[13px] text-slate-400">{h.billing_period || "-"}</td>
                    <td className="px-5 py-4 text-[13px] text-slate-400">{formatDate(h.started_at)}</td>
                    <td className="px-5 py-4 text-[13px] text-slate-400">{formatDate(h.ended_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
