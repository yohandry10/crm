"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Building2, Settings, Users, Check, Loader2, ArrowRight, ArrowLeft, Plus, X } from "lucide-react"
import { toast } from "sonner"

const STEPS = [
  { id: 1, title: "Datos de Empresa", icon: Building2 },
  { id: 2, title: "Configuración", icon: Settings },
  { id: 3, title: "Invitar Equipo", icon: Users },
]

interface CompanyData {
  name: string
  ruc: string
  address: string
  phone: string
  email: string
}

interface ConfigData {
  currency: string
  taxRate: number
  serieFactura: string
  serieBoleta: string
  timezone: string
}

interface TeamMember {
  email: string
  role: string
}

export default function OnboardingPage() {
  const router = useRouter()
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [companyData, setCompanyData] = useState<CompanyData>({
    name: "", ruc: "", address: "", phone: "", email: ""
  })

  const [configData, setConfigData] = useState<ConfigData>({
    currency: "PEN", taxRate: 18, serieFactura: "F001", serieBoleta: "B001", timezone: "America/Lima"
  })

  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newMember, setNewMember] = useState({ email: "", role: "sales" })

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient())
  }, [])

  useEffect(() => {
    if (supabase) checkOnboardingStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const checkOnboardingStatus = async () => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push("/login")
        return
      }

      // Get user's organization
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id, organizations(*)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single()

      if (!membership) {
        router.push("/login")
        return
      }

      const org = membership.organizations as any
      if (org.onboarding_completed) {
        router.push("/dashboard")
        return
      }

      setOrganizationId(membership.organization_id)
      setCompanyData(prev => ({
        ...prev,
        name: org.name || "",
        ruc: org.ruc || "",
      }))
    } catch (error) {
      console.error("Error checking onboarding:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (currentStep === 1) {
      if (!companyData.name || !companyData.ruc) {
        toast.error("Nombre y RUC son requeridos")
        return
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 3))
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const addTeamMember = () => {
    if (!newMember.email) {
      toast.error("Ingresa un email")
      return
    }
    if (teamMembers.some(m => m.email === newMember.email)) {
      toast.error("Este email ya está agregado")
      return
    }
    setTeamMembers(prev => [...prev, { ...newMember }])
    setNewMember({ email: "", role: "sales" })
  }

  const removeTeamMember = (email: string) => {
    setTeamMembers(prev => prev.filter(m => m.email !== email))
  }

  const handleComplete = async () => {
    if (!organizationId) return

    setSaving(true)
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          companyData,
          configData,
          teamMembers,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("¡Configuración completada!")
        router.push("/dashboard")
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between mb-4">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex items-center gap-2 ${
                  step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step.id < currentStep ? "bg-primary text-primary-foreground" :
                  step.id === currentStep ? "bg-primary/20 border-2 border-primary" :
                  "bg-muted"
                }`}>
                  {step.id < currentStep ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{step.title}</span>
              </div>
            ))}
          </div>
          <Progress value={(currentStep / 3) * 100} className="h-2" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {currentStep === 1 && "Datos de tu Empresa"}
              {currentStep === 2 && "Configuración Inicial"}
              {currentStep === 3 && "Invita a tu Equipo"}
            </CardTitle>
            <CardDescription>
              {currentStep === 1 && "Ingresa la información básica de tu empresa"}
              {currentStep === 2 && "Configura las opciones de facturación y moneda"}
              {currentStep === 3 && "Invita a los miembros de tu equipo (opcional)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Company Data */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la Empresa *</Label>
                    <Input
                      value={companyData.name}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Mi Empresa SAC"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RUC *</Label>
                    <Input
                      value={companyData.ruc}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, ruc: e.target.value }))}
                      placeholder="20123456789"
                      maxLength={11}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Dirección</Label>
                  <Input
                    value={companyData.address}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Av. Principal 123, Lima"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={companyData.phone}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+51 999 123 456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email de Contacto</Label>
                    <Input
                      type="email"
                      value={companyData.email}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="contacto@empresa.com"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Configuration */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Moneda Principal</Label>
                    <Select
                      value={configData.currency}
                      onValueChange={(v) => setConfigData(prev => ({ ...prev, currency: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PEN">PEN - Sol Peruano</SelectItem>
                        <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tasa de IGV (%)</Label>
                    <Input
                      type="number"
                      value={configData.taxRate}
                      onChange={(e) => setConfigData(prev => ({ ...prev, taxRate: Number(e.target.value) }))}
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Serie Factura</Label>
                    <Input
                      value={configData.serieFactura}
                      onChange={(e) => setConfigData(prev => ({ ...prev, serieFactura: e.target.value.toUpperCase() }))}
                      placeholder="F001"
                      maxLength={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Serie Boleta</Label>
                    <Input
                      value={configData.serieBoleta}
                      onChange={(e) => setConfigData(prev => ({ ...prev, serieBoleta: e.target.value.toUpperCase() }))}
                      placeholder="B001"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Zona Horaria</Label>
                  <Select
                    value={configData.timezone}
                    onValueChange={(v) => setConfigData(prev => ({ ...prev, timezone: v }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Lima">America/Lima (UTC-5)</SelectItem>
                      <SelectItem value="America/Bogota">America/Bogota (UTC-5)</SelectItem>
                      <SelectItem value="America/Mexico_City">America/Mexico_City (UTC-6)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Step 3: Team */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={newMember.email}
                    onChange={(e) => setNewMember(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@ejemplo.com"
                    className="flex-1"
                  />
                  <Select
                    value={newMember.role}
                    onValueChange={(v) => setNewMember(prev => ({ ...prev, role: v }))}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="sales">Vendedor</SelectItem>
                      <SelectItem value="support">Soporte</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="button" onClick={addTeamMember} size="icon">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {teamMembers.length > 0 ? (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div key={member.email} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-medium">{member.email}</p>
                          <p className="text-xs text-muted-foreground capitalize">{member.role}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeTeamMember(member.email)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Puedes invitar a tu equipo ahora o hacerlo después desde Configuración
                  </p>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 1}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Anterior
              </Button>

              {currentStep < 3 ? (
                <Button onClick={handleNext} className="gap-2">
                  Siguiente
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={handleComplete} disabled={saving} className="gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Completar Configuración
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
