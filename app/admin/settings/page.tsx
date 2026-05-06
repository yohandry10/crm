"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Settings, CreditCard, Mail, Shield, Loader2, KeyRound } from "lucide-react"
import { toast } from "sonner"

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState({
    defaultTrialDays: 2,
    allowSelfSignup: false,
    requireEmailVerification: true,
    maintenanceMode: false,
    culqiEnabled: false,
    pagoEfectivoEnabled: false,
  })
  const [activeTab, setActiveTab] = useState("general")

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)
      try {
        const res = await fetch("/api/admin/settings", {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })
        const json = await res.json()
        if (!res.ok || !json?.success) {
          throw new Error(json?.error || `HTTP ${res.status}`)
        }

        if (!cancelled) {
          setSettings((prev) => ({ ...prev, ...json.data }))
        }
      } catch (err: any) {
        // Don't block the page; just show defaults and allow retry via Save.
        toast.error(err?.message || "No se pudo cargar la configuración")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadSettings()
    return () => {
      cancelled = true
    }
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }

      setSettings((prev) => ({ ...prev, ...json.data }))
      toast.success("Configuración guardada")
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: "general", label: "General", icon: Settings },
    { id: "payments", label: "Pagos", icon: CreditCard },
    { id: "email", label: "Email", icon: Mail },
    { id: "security", label: "Seguridad", icon: Shield },
  ]

  const EnvManagedNotice = ({ title, description, keys }: { title: string; description: string; keys: string[] }) => (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
          <KeyRound className="h-4 w-4 text-amber-300" />
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[13px] font-semibold text-amber-100">{title}</p>
            <p className="text-[12px] text-amber-100/70">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {keys.map((key) => (
              <code key={key} className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[11px] text-amber-50">
                {key}
              </code>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-100 tracking-tight">Configuración de Plataforma</h1>
        <p className="text-sm text-slate-500 mt-1">Ajustes globales del sistema</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/[0.06] pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "general" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-100">Configuración General</h3>
              <p className="text-[12px] text-slate-500">Ajustes básicos de la plataforma</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-slate-300">Días de Trial por Defecto</Label>
            <Input
              type="number"
              value={settings.defaultTrialDays}
              onChange={(e) => setSettings(prev => ({ ...prev, defaultTrialDays: Number(e.target.value) }))}
              min={1}
              max={30}
              className="w-32 bg-white/[0.04] border-white/[0.08] text-slate-200"
            />
            <p className="text-[12px] text-slate-500">
              Período de prueba para nuevas organizaciones
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <div>
              <p className="font-medium text-[14px] text-slate-200">Permitir Auto-Registro</p>
              <p className="text-[12px] text-slate-500">
                Permitir que usuarios se registren sin invitación
              </p>
            </div>
            <Switch
              checked={settings.allowSelfSignup}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, allowSelfSignup: checked }))}
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <div>
              <p className="font-medium text-[14px] text-slate-200">Modo Mantenimiento</p>
              <p className="text-[12px] text-slate-500">
                Bloquear acceso a usuarios (excepto admins)
              </p>
            </div>
            <Switch
              checked={settings.maintenanceMode}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, maintenanceMode: checked }))}
            />
          </div>

          <Button onClick={saveSettings} disabled={loading || saving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {(loading || saving) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      )}

      {activeTab === "payments" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-100">Configuración de Pagos</h3>
              <p className="text-[12px] text-slate-500">Integración con pasarelas de pago</p>
            </div>
          </div>

          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[14px] text-slate-200">Culqi</p>
                <p className="text-[12px] text-slate-500">Tarjetas y pagos locales</p>
              </div>
              <Switch
                checked={settings.culqiEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, culqiEnabled: checked }))}
              />
            </div>
            {settings.culqiEnabled && (
              <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                <EnvManagedNotice
                  title="Credenciales gestionadas por entorno"
                  description="Este panel solo activa la pasarela. Las claves no se editan aqui para evitar inputs visuales sin persistencia segura."
                  keys={["CULQI_PUBLIC_KEY", "CULQI_SECRET_KEY"]}
                />
              </div>
            )}
          </div>

          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[14px] text-slate-200">PagoEfectivo</p>
                <p className="text-[12px] text-slate-500">Voucher y banca por internet</p>
              </div>
              <Switch
                checked={settings.pagoEfectivoEnabled}
                onCheckedChange={(checked) => setSettings(prev => ({ ...prev, pagoEfectivoEnabled: checked }))}
              />
            </div>
            {settings.pagoEfectivoEnabled && (
              <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                <EnvManagedNotice
                  title="Credenciales gestionadas por entorno"
                  description="Este panel solo activa la pasarela. El token real se valida desde variables de entorno del despliegue."
                  keys={["PAGO_EFECTIVO_ACCESS_TOKEN"]}
                />
              </div>
            )}
          </div>

          <Button onClick={saveSettings} disabled={loading || saving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {(loading || saving) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      )}

      {activeTab === "email" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-100">Configuración de Email</h3>
              <p className="text-[12px] text-slate-500">Servicio de envío de correos</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300">Proveedor de Email</Label>
              <Input value="Resend" disabled className="bg-white/[0.04] border-white/[0.08] text-slate-400" />
            </div>
            <EnvManagedNotice
              title="Email configurado por entorno"
              description="Las credenciales y remitentes se cargan desde variables del entorno de produccion; no se muestran campos editables sin backend seguro."
              keys={["RESEND_API_KEY", "RESEND_FROM_EMAIL"]}
            />
          </div>

          <Button onClick={saveSettings} disabled={loading || saving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {(loading || saving) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      )}

      {activeTab === "security" && (
        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-slate-100">Seguridad</h3>
              <p className="text-[12px] text-slate-500">Configuración de seguridad de la plataforma</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <div>
              <p className="font-medium text-[14px] text-slate-200">Verificación de Email Requerida</p>
              <p className="text-[12px] text-slate-500">
                Los usuarios deben verificar su email antes de acceder
              </p>
            </div>
            <Switch
              checked={settings.requireEmailVerification}
              onCheckedChange={(checked) => setSettings(prev => ({ ...prev, requireEmailVerification: checked }))}
            />
          </div>

          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04]">
            <p className="font-medium text-[14px] text-slate-200 mb-3">Políticas de Seguridad Activas</p>
            <div className="space-y-2">
              {[
                "CSRF Protection",
                "Row Level Security (RLS)",
                "Multi-tenant Isolation",
                "Secure Headers",
                "Rate Limiting"
              ].map((policy) => (
                <div key={policy} className="flex items-center gap-2 text-[13px] text-slate-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  {policy}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={saveSettings} disabled={loading || saving} className="bg-cyan-600 hover:bg-cyan-700 text-white">
            {(loading || saving) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar Cambios
          </Button>
        </div>
      )}
    </div>
  )
}
