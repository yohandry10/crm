"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Building2, Loader2, Mail, Send } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function NewOrganizationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    ruc: "",
    ownerEmail: "",
    trialDays: "2",
  })
  const [result, setResult] = useState<{ organizationId: string; invitationToken: string } | null>(null)

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: generateSlug(name)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.ownerEmail) {
      toast.error("Nombre y email del owner son requeridos")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          slug: formData.slug || generateSlug(formData.name),
          ruc: formData.ruc || null,
          ownerEmail: formData.ownerEmail,
          trialDays: parseInt(formData.trialDays),
        }),
      })

      const json = await res.json()
      
      if (json.success) {
        setResult(json.data)
        toast.success("Organización creada exitosamente")
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al crear organización")
    } finally {
      setLoading(false)
    }
  }

  const sendInvitation = async () => {
    if (!result) return
    
    setLoading(true)
    try {
      const res = await fetch("/api/admin/organizations/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: result.organizationId,
          email: formData.ownerEmail,
          token: result.invitationToken,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Invitación enviada exitosamente")
        router.push("/admin/organizations")
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al enviar invitación")
    } finally {
      setLoading(false)
    }
  }

  const copyInviteLink = () => {
    if (!result) return
    const link = `${window.location.origin}/signup?token=${result.invitationToken}`
    navigator.clipboard.writeText(link)
    toast.success("Link copiado al portapapeles")
  }

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/organizations">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Organización Creada</h1>
          <p className="text-sm text-slate-600">Envía la invitación al owner</p>
          </div>
        </div>

        <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 max-w-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-emerald-400">¡Éxito!</h3>
              <p className="text-[12px] text-slate-500">
                La organización "{formData.name}" ha sido creada con un trial de {formData.trialDays} días.
              </p>
            </div>
          </div>

          <div className="p-4 bg-white/[0.02] rounded-xl border border-white/[0.04] space-y-2 mb-5">
            <p className="text-[13px] text-slate-300"><span className="text-slate-500">Organización:</span> {formData.name}</p>
            <p className="text-[13px] text-slate-300"><span className="text-slate-500">Slug:</span> {formData.slug}</p>
            <p className="text-[13px] text-slate-300"><span className="text-slate-500">Email Owner:</span> {formData.ownerEmail}</p>
            <p className="text-[13px] text-slate-300"><span className="text-slate-500">Trial:</span> {formData.trialDays} días</p>
          </div>

          <div className="space-y-2 mb-5">
            <Label className="text-slate-300">Link de Invitación</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/signup?token=${result.invitationToken}`}
                className="font-mono text-[11px] bg-white/[0.04] border-white/[0.08] text-slate-400"
              />
              <Button variant="outline" onClick={copyInviteLink} className="border-white/[0.08] text-slate-300 hover:bg-white/[0.04]">
                Copiar
              </Button>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={sendInvitation} disabled={loading} className="flex-1 gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar Invitación por Email
            </Button>
            <Button variant="outline" onClick={() => router.push("/admin/organizations")} className="border-white/[0.08] text-slate-300 hover:bg-white/[0.04]">
              Ir a Organizaciones
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/organizations">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-200 hover:bg-white/[0.06]">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Nueva Organización</h1>
          <p className="text-sm text-slate-600">Crea una nueva organización y envía invitación al owner</p>
        </div>
      </div>

      <div className="bg-[#101722] border border-white/[0.06] rounded-2xl p-6 max-w-xl">
        <div className="mb-5">
          <h3 className="text-[15px] font-semibold text-slate-100">Datos de la Organización</h3>
          <p className="text-[12px] text-slate-500">
            Ingresa los datos básicos. El owner completará el resto en el wizard de onboarding.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-slate-300">Nombre de la Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Mi Empresa SAC"
              required
              className="bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug" className="text-slate-300">Slug (URL)</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              placeholder="mi-empresa"
              className="bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
            />
            <p className="text-[11px] text-slate-500">
              Se genera automáticamente del nombre
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ruc" className="text-slate-300">RUC (opcional)</Label>
            <Input
              id="ruc"
              value={formData.ruc}
              onChange={(e) => setFormData(prev => ({ ...prev, ruc: e.target.value }))}
              placeholder="20123456789"
              maxLength={11}
              className="bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ownerEmail" className="text-slate-300">Email del Owner *</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                id="ownerEmail"
                type="email"
                value={formData.ownerEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, ownerEmail: e.target.value }))}
                placeholder="owner@empresa.com"
                className="pl-9 bg-white/[0.04] border-white/[0.08] text-slate-200 placeholder:text-slate-500"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Se enviará una invitación a este email
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="trialDays" className="text-slate-300">Días de Trial</Label>
            <Select
              value={formData.trialDays}
              onValueChange={(v) => setFormData(prev => ({ ...prev, trialDays: v }))}
            >
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2332] border-white/[0.08]">
                <SelectItem value="2" className="text-slate-300 focus:bg-white/[0.06]">2 días (estándar)</SelectItem>
                <SelectItem value="7" className="text-slate-300 focus:bg-white/[0.06]">7 días</SelectItem>
                <SelectItem value="14" className="text-slate-300 focus:bg-white/[0.06]">14 días</SelectItem>
                <SelectItem value="30" className="text-slate-300 focus:bg-white/[0.06]">30 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={loading} className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700 text-white">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear Organización
          </Button>
        </form>
      </div>
    </div>
  )
}
