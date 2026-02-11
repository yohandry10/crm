"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { motion, AnimatePresence } from "framer-motion"
import { Settings, User, Bell, Database, Key, Phone, Building, Loader2, Users, CreditCard, ArrowRight, HelpCircle, RotateCcw, Eye, EyeOff, Lock, Wallet, QrCode, Landmark, Link2, Receipt, Palette } from "lucide-react"
import { toast } from "sonner"
import { resetAllTutorials, resetWelcomeTour } from "@/components/tutorials"
import { useTheme } from "@/hooks/use-theme"

// Appearance Settings Component
function AppearanceSettings() {
  const { theme, setColorTheme, setBgMode, colorThemes, bgModes } = useTheme()

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md">
        <CardHeader className="border-b border-gray-100 bg-white/50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Palette className="w-5 h-5 text-pink-600" />
            Color del Tema
          </CardTitle>
          <CardDescription>Elige el color principal para gradientes y acentos</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid gap-4 md:grid-cols-5">
            {colorThemes.map((colorTheme) => (
              <button
                key={colorTheme.id}
                onClick={() => setColorTheme(colorTheme.id)}
                className={`group relative p-4 rounded-2xl border-2 transition-all hover:scale-105 ${theme.colorTheme === colorTheme.id
                  ? 'border-gray-900 shadow-lg'
                  : 'border-gray-200 hover:border-gray-300'
                  }`}
              >
                <div className={`h-16 rounded-xl ${colorTheme.previewClass} shadow-inner`} />
                <p className="mt-3 text-sm font-medium text-gray-900 text-center">{colorTheme.name}</p>
                {theme.colorTheme === colorTheme.id && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md">
        <CardHeader className="border-b border-gray-100 bg-white/50">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Settings className="w-5 h-5 text-blue-600" />
            Fondo del Dashboard
          </CardTitle>
          <CardDescription>Personaliza el color de fondo principal</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="grid gap-4 md:grid-cols-4">
            {bgModes.map((bgMode) => (
              <button
                key={bgMode.id}
                onClick={() => setBgMode(bgMode.id)}
                className={`group relative p-6 rounded-2xl border-2 transition-all hover:scale-105 ${theme.bgMode === bgMode.id
                    ? 'border-gray-900 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                  } ${bgMode.id === 'dark' ? 'dark bg-gray-950' : 'bg-white'}`}
              >
                <div className={`h-24 rounded-xl ${bgMode.bgClass} border border-gray-200 shadow-inner flex items-center justify-center`}>
                  <span className={`text-xs font-bold ${bgMode.textClass}`}>Aa</span>
                </div>
                <p className={`mt-3 text-sm font-medium text-center ${bgMode.id === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>{bgMode.name}</p>
                {theme.bgMode === bgMode.id && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs">
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-sm text-blue-900">
              💡 <strong>Tip:</strong> Los cambios se aplican instantáneamente y se guardan automáticamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Security Settings Component
function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Completa todos los campos")
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    if (newPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const json = await res.json()

      if (json.success) {
        toast.success("Contraseña actualizada correctamente")
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast.error(json.error || "Error al cambiar contraseña")
      }
    } catch (error: any) {
      toast.error(error.message || "Error al cambiar contraseña")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="w-5 h-5" />
          Cambiar Contraseña
        </CardTitle>
        <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Contraseña Actual</Label>
          <div className="relative">
            <Input
              type={showCurrentPassword ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            >
              {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Nueva Contraseña</Label>
          <div className="relative">
            <Input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowNewPassword(!showNewPassword)}
            >
              {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres</p>
        </div>

        <div className="space-y-2">
          <Label>Confirmar Nueva Contraseña</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>

        <Button
          onClick={handleChangePassword}
          disabled={saving || !currentPassword || !newPassword || !confirmPassword}
          className="gradient-neon border-0"
        >
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Cambiar Contraseña
        </Button>
      </CardContent>
    </Card>
  )
}

interface OrganizationSettings {
  id?: string
  organization_id?: string
  company_name?: string
  company_ruc?: string
  company_address?: string
  company_phone?: string
  company_email?: string
  serie_factura?: string
  serie_boleta?: string
  serie_nota_credito?: string
  default_currency?: string
  default_tax_rate?: number
  timezone?: string
  notify_new_lead?: boolean
  notify_task_due?: boolean
  notify_payment_received?: boolean
  notify_invoice_overdue?: boolean
  // Payment methods
  logo_url?: string
  yape_phone?: string
  yape_qr_url?: string
  plin_phone?: string
  plin_qr_url?: string
  bank_name?: string
  bank_account?: string
  bank_cci?: string
  bank_holder?: string
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<OrganizationSettings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Guardar los datos originales serializados para comparación exacta
  const [originalSettingsSnapshot, setOriginalSettingsSnapshot] = useState<string | null>(null)
  // Flag para indicar cuando el usuario ha interactuado con algún campo
  const [userHasEdited, setUserHasEdited] = useState(false)

  // Calcular hasChanges comparando snapshot serializado
  const hasChanges = useCallback(() => {
    // Si el usuario no ha editado nada, no hay cambios
    if (!userHasEdited) return false
    // Si no hay snapshot original, no podemos comparar
    if (!originalSettingsSnapshot) return false

    const fieldsToCompare: (keyof OrganizationSettings)[] = [
      'company_name', 'company_ruc', 'company_address', 'company_phone',
      'company_email', 'timezone', 'serie_factura', 'serie_boleta',
      'serie_nota_credito', 'default_currency', 'default_tax_rate'
    ]

    // Crear snapshot actual solo de los campos relevantes
    const currentSnapshot: Record<string, string> = {}
    fieldsToCompare.forEach(field => {
      currentSnapshot[field] = String(settings[field] ?? '')
    })

    return JSON.stringify(currentSnapshot) !== originalSettingsSnapshot
  }, [settings, originalSettingsSnapshot, userHasEdited])

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await fetch("/api/settings")
      const json = await res.json()
      if (json.success && json.data) {
        setSettings(json.data)
        // Crear snapshot serializado de los datos originales
        const fieldsToCompare: (keyof OrganizationSettings)[] = [
          'company_name', 'company_ruc', 'company_address', 'company_phone',
          'company_email', 'timezone', 'serie_factura', 'serie_boleta',
          'serie_nota_credito', 'default_currency', 'default_tax_rate'
        ]
        const snapshot: Record<string, string> = {}
        fieldsToCompare.forEach(field => {
          snapshot[field] = String(json.data[field] ?? '')
        })
        setOriginalSettingsSnapshot(JSON.stringify(snapshot))
        // Resetear el flag de edición
        setUserHasEdited(false)
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      toast.error("Error al cargar configuración")
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })

      const json = await res.json()

      if (json.success) {
        setSettings(json.data)
        // Actualizar el snapshot con los nuevos datos guardados
        const fieldsToCompare: (keyof OrganizationSettings)[] = [
          'company_name', 'company_ruc', 'company_address', 'company_phone',
          'company_email', 'timezone', 'serie_factura', 'serie_boleta',
          'serie_nota_credito', 'default_currency', 'default_tax_rate'
        ]
        const snapshot: Record<string, string> = {}
        fieldsToCompare.forEach(field => {
          snapshot[field] = String(json.data[field] ?? '')
        })
        setOriginalSettingsSnapshot(JSON.stringify(snapshot))
        // Resetear flag de edición
        setUserHasEdited(false)
        toast.success("Configuración actualizada")
      } else {
        // Si el error es porque no hay cambios, mostrar warning claro
        const errorMsg = json.error || "Error al guardar"
        if (errorMsg.includes("No hay cambios") || errorMsg.includes("ya están actualizados")) {
          toast.warning("⚠️ Estos datos ya existen y están guardados. No hay cambios que guardar.", {
            duration: 5000,
          })
          // Resetear el flag para que el botón vuelva a deshabilitarse
          setUserHasEdited(false)
        } else {
          toast.error(errorMsg)
        }
      }
    } catch (error: any) {
      console.error("Error guardando settings:", error)
      toast.error(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const updateField = (field: keyof OrganizationSettings, value: any) => {
    // Marcar que el usuario ha editado algo
    setUserHasEdited(true)
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  // --- UI COMPONENTS ---

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="relative">
            <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full" />
            <Loader2 className="w-12 h-12 animate-spin text-cyan-500 relative z-10" />
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 pb-10">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1"
          >
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">
              Configuraciones
            </h1>
            <p className="text-muted-foreground text-lg">
              Gestiona el núcleo de tu sistema NEON
            </p>
          </motion.div>
        </div>

        {/* Quick Links */}
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { href: "/settings/team", icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", title: "Equipo", desc: "Gestionar miembros" },
            { href: "/settings/billing", icon: CreditCard, color: "text-green-500", bg: "bg-green-500/10", title: "Suscripción", desc: "Plan y facturación" },
            { href: "/profile", icon: User, color: "text-purple-500", bg: "bg-purple-500/10", title: "Mi Perfil", desc: "Cuenta y seguridad" }
          ].map((item, i) => (
            <Link key={item.href} href={item.href}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="group relative overflow-hidden rounded-2xl bg-white border border-gray-100 p-6 shadow-sm hover:shadow-xl hover:shadow-cyan-500/10 transition-all duration-300"
              >
                <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${item.color}`}>
                  <item.icon className="w-24 h-24 -mr-8 -mt-8 rotate-12" />
                </div>
                <div className="relative z-10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${item.bg} flex items-center justify-center shadow-inner`}>
                      <item.icon className={`w-6 h-6 ${item.color}`} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-cyan-600 transition-colors">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>

        <Tabs defaultValue="general" className="space-y-8">
          <div className="sticky top-20 z-20 bg-white/80 backdrop-blur-xl py-4 -mx-6 px-6 border-b border-gray-200/50">
            <TabsList className="w-full flex justify-start gap-2 bg-transparent p-0 h-auto overflow-x-auto scrollbar-none">
              {[
                { value: "general", label: "General", icon: Building },
                { value: "apariencia", label: "Apariencia", icon: Palette },
                { value: "billing", label: "Facturación", icon: Settings },
                { value: "payments", label: "Medios de Pago", icon: Wallet },
                { value: "security", label: "Seguridad", icon: Lock },
                { value: "notifications", label: "Notificaciones", icon: Bell },
                { value: "integrations", label: "Integraciones", icon: Link2 },
                { value: "help", label: "Ayuda", icon: HelpCircle },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="group flex items-center gap-2 px-5 py-2.5 rounded-full border border-gray-200 bg-white hover:bg-gray-50 data-[state=active]:border-cyan-500 data-[state=active]:bg-cyan-50 data-[state=active]:text-cyan-700 transition-all duration-300 shadow-sm"
                >
                  <tab.icon className="w-4 h-4 group-data-[state=active]:text-cyan-600" />
                  <span>{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <TabsContent value="general" className="space-y-6 mt-0">
                <Card className="border-0 shadow-lg shadow-gray-200/40 overflow-hidden bg-white/60 backdrop-blur-md">
                  <div className="absolute inset-0 bg-gradient-to-br from-white via-transparent to-gray-50/50 pointer-events-none" />
                  <CardHeader className="relative border-b border-gray-100 bg-white/50">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <Building className="w-5 h-5 text-cyan-600" />
                          Información de la Empresa
                        </CardTitle>
                        <CardDescription>Esta información es pública en tus documentos oficiales.</CardDescription>
                      </div>
                      {settings.company_name && (
                        <div className="px-3 py-1 rounded-full bg-green-100/50 border border-green-200 text-green-700 text-xs font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Verificado
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-8 relative space-y-8">
                    <div className="grid gap-8 md:grid-cols-2">
                      {/* Company Identity */}
                      <div className="space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <Building className="w-4 h-4" /> Identidad
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Nombre Comercial</Label>
                            <Input
                              value={settings.company_name || ""}
                              onChange={(e) => updateField("company_name", e.target.value)}
                              className="bg-white border-gray-200 focus:border-cyan-500 focus:ring-cyan-500/20 transition-all font-medium"
                              placeholder="Ej. NEON System SAC"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>RUC / Tax ID</Label>
                            <Input
                              value={settings.company_ruc || ""}
                              onChange={(e) => updateField("company_ruc", e.target.value)}
                              className="bg-white font-mono tracking-wide"
                              maxLength={11}
                              placeholder="10765432101"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Zona Horaria</Label>
                            <Select
                              value={settings.timezone || "America/Lima"}
                              onValueChange={(v) => updateField("timezone", v)}
                            >
                              <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="America/Lima">🇵🇪 Lima (UTC-5)</SelectItem>
                                <SelectItem value="America/Bogota">🇨🇴 Bogota (UTC-5)</SelectItem>
                                <SelectItem value="America/Mexico_City">🇲🇽 Mexico City (UTC-6)</SelectItem>
                                <SelectItem value="America/New_York">🇺🇸 New York (UTC-5)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                          <Phone className="w-4 h-4" /> Contacto
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Dirección Fiscal</Label>
                            <Input
                              value={settings.company_address || ""}
                              onChange={(e) => updateField("company_address", e.target.value)}
                              className="bg-white"
                              placeholder="Av. Javier Prado 123"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Teléfono</Label>
                            <Input
                              value={settings.company_phone || ""}
                              onChange={(e) => updateField("company_phone", e.target.value)}
                              className="bg-white"
                              placeholder="+51 900 000 000"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Email de Contacto</Label>
                            <Input
                              type="email"
                              value={settings.company_email || ""}
                              onChange={(e) => updateField("company_email", e.target.value)}
                              className="bg-white"
                              placeholder="contacto@empresa.com"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                      <Button
                        onClick={saveSettings}
                        disabled={saving || !hasChanges()}
                        className={`min-w-[150px] transition-all duration-300 shadow-lg ${hasChanges()
                          ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-cyan-500/25 scale-105"
                          : "bg-gray-100 text-gray-400 border border-gray-200 shadow-none hover:bg-gray-200"
                          }`}
                        size="lg"
                      >
                        {saving ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...
                          </>
                        ) : hasChanges() ? (
                          <>Guardar Cambios</>
                        ) : (
                          "Todo al día"
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="apariencia" className="space-y-6 mt-0">
                <AppearanceSettings />
              </TabsContent>

              <TabsContent value="billing" className="space-y-6 mt-0">
                <Card className="border-0 shadow-lg shadow-gray-200/40 overflow-hidden bg-white/60 backdrop-blur-md">
                  <CardHeader className="border-b border-gray-100 bg-white/50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Receipt className="w-5 h-5 text-purple-600" />
                      Series y Facturación
                    </CardTitle>
                    <CardDescription>Controla la numeración de tus comprobantes electrónicos.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="grid gap-6 md:grid-cols-3">
                      {[
                        { label: "Serie Factura", field: "serie_factura", placeholder: "F001", color: "text-blue-600", bg: "bg-blue-50" },
                        { label: "Serie Boleta", field: "serie_boleta", placeholder: "B001", color: "text-green-600", bg: "bg-green-50" },
                        { label: "Serie Nota Crédito", field: "serie_nota_credito", placeholder: "FC01", color: "text-orange-600", bg: "bg-orange-50" },
                      ].map((item) => (
                        <div key={item.field} className="relative group p-4 rounded-xl border border-gray-200 hover:border-gray-300 bg-white hover:shadow-md transition-all">
                          <div className={`absolute -top-3 left-4 px-2 py-0.5 rounded text-xs font-bold ${item.bg} ${item.color}`}>
                            {item.label}
                          </div>
                          <Input
                            value={settings[item.field as keyof OrganizationSettings] as string || ""}
                            onChange={(e) => updateField(item.field as keyof OrganizationSettings, e.target.value.toUpperCase())}
                            className="text-center font-mono text-2xl tracking-widest border-0 focus-visible:ring-0 px-0 h-10 font-bold bg-transparent text-gray-800 placeholder:text-gray-200"
                            placeholder={item.placeholder}
                            maxLength={4}
                          />
                          <p className="text-center text-[10px] text-muted-foreground mt-1">4 caracteres</p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-6 md:grid-cols-2 bg-gray-50/50 p-6 rounded-2xl border border-gray-100">
                      <div className="space-y-2">
                        <Label>Moneda Principal</Label>
                        <Select
                          value={settings.default_currency || "PEN"}
                          onValueChange={(v) => updateField("default_currency", v)}
                        >
                          <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="PEN">S/ Sol Peruano</SelectItem>
                            <SelectItem value="USD">$ Dólar Americano</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>IGV (%)</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            value={settings.default_tax_rate ?? ""}
                            onChange={(e) => updateField("default_tax_rate", e.target.value ? Number(e.target.value) : null)}
                            className="bg-white pl-8"
                            placeholder="18"
                          />
                          <span className="absolute left-3 top-2.5 text-gray-400 font-bold">%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button onClick={saveSettings} disabled={saving || !hasChanges()} className={hasChanges() ? "gradient-neon border-0" : ""} variant={hasChanges() ? "default" : "secondary"}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {hasChanges() ? "Guardar Series" : "Sin cambios"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="payments" className="space-y-6 mt-0">
                <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md">
                  <CardHeader className="border-b border-gray-100 bg-white/50">
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Wallet className="w-5 h-5 text-cyan-600" />
                      Medios de Pago
                    </CardTitle>
                    <CardDescription>Personaliza cómo te pagan tus clientes.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">

                    <div className="flex items-start gap-6 bg-blue-50/30 p-6 rounded-2xl border border-blue-100/50">
                      <div className="w-20 h-20 rounded-xl bg-white border border-gray-200 flex items-center justify-center p-2 shrink-0 shadow-sm">
                        {settings.logo_url ? (
                          <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <Building className="w-8 h-8 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 space-y-3">
                        <Label className="text-base font-semibold text-blue-900">Logo Corporativo</Label>
                        <Input
                          value={settings.logo_url || ""}
                          onChange={(e) => updateField("logo_url", e.target.value)}
                          className="bg-white"
                          placeholder="https://ejemplo.com/logo.png"
                        />
                        <p className="text-xs text-blue-600/70">Este logo aparecerá en la cabecera de tus facturas y correos.</p>
                      </div>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="relative group overflow-hidden bg-gradient-to-br from-purple-500/5 to-purple-600/5 border border-purple-100 rounded-2xl p-6 hover:shadow-lg hover:shadow-purple-500/10 transition-all">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 shadow-inner">
                            <Phone className="w-5 h-5" />
                          </div>
                          <h4 className="font-bold text-lg text-purple-900">Yape</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase text-purple-400 font-bold tracking-wider">Número</Label>
                            <Input
                              value={settings.yape_phone || ""}
                              onChange={(e) => updateField("yape_phone", e.target.value)}
                              className="bg-white/80 border-purple-100 focus:border-purple-500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase text-purple-400 font-bold tracking-wider">QR URL</Label>
                            <Input
                              value={settings.yape_qr_url || ""}
                              onChange={(e) => updateField("yape_qr_url", e.target.value)}
                              className="bg-white/80 border-purple-100 focus:border-purple-500 text-xs"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>

                      <div className="relative group overflow-hidden bg-gradient-to-br from-cyan-500/5 to-cyan-600/5 border border-cyan-100 rounded-2xl p-6 hover:shadow-lg hover:shadow-cyan-500/10 transition-all">
                        <div className="flex items-center gap-3 mb-6">
                          <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center text-cyan-600 shadow-inner">
                            <QrCode className="w-5 h-5" />
                          </div>
                          <h4 className="font-bold text-lg text-cyan-900">Plin</h4>
                        </div>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase text-cyan-400 font-bold tracking-wider">Número</Label>
                            <Input
                              value={settings.plin_phone || ""}
                              onChange={(e) => updateField("plin_phone", e.target.value)}
                              className="bg-white/80 border-cyan-100 focus:border-cyan-500"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs uppercase text-cyan-400 font-bold tracking-wider">QR URL</Label>
                            <Input
                              value={settings.plin_qr_url || ""}
                              onChange={(e) => updateField("plin_qr_url", e.target.value)}
                              className="bg-white/80 border-cyan-100 focus:border-cyan-500 text-xs"
                              placeholder="https://..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-8 border border-gray-200">
                      <div className="flex items-center gap-3 mb-6">
                        <Landmark className="w-6 h-6 text-gray-400" />
                        <h4 className="font-bold text-gray-700">Cuenta Bancaria Principal</h4>
                      </div>
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Banco</Label>
                          <Select
                            value={settings.bank_name || ""}
                            onValueChange={(v) => updateField("bank_name", v)}
                          >
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Selecciona" /></SelectTrigger>
                            <SelectContent>
                              {["BCP", "Interbank", "BBVA", "Scotiabank", "BanBif", "Pichincha", "Otro"].map(b => (
                                <SelectItem key={b} value={b}>{b}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Titular</Label>
                          <Input
                            value={settings.bank_holder || ""}
                            onChange={(e) => updateField("bank_holder", e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Nº Cuenta</Label>
                          <Input
                            value={settings.bank_account || ""}
                            onChange={(e) => updateField("bank_account", e.target.value)}
                            className="bg-white font-mono"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CCI</Label>
                          <Input
                            value={settings.bank_cci || ""}
                            onChange={(e) => updateField("bank_cci", e.target.value)}
                            className="bg-white font-mono"
                            maxLength={23}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4">
                      <Button onClick={saveSettings} disabled={saving || !hasChanges()} className={hasChanges() ? "gradient-neon border-0" : ""} variant={hasChanges() ? "default" : "secondary"}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {hasChanges() ? "Guardar Medios de Pago" : "Sin cambios"}
                      </Button>
                    </div>

                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security" className="mt-0">
                <SecuritySettings />
              </TabsContent>

              <TabsContent value="notifications" className="mt-0">
                <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bell className="w-5 h-5 text-yellow-500" /> Notificaciones</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6 p-8">
                    {[
                      { label: "Nuevos Leads", field: "notify_new_lead", desc: "Cuando alguien llena un formulario" },
                      { label: "Tareas Vencidas", field: "notify_task_due", desc: "Recordatorios de agenda" },
                      { label: "Pagos Recibidos", field: "notify_payment_received", desc: "Confirmaciones de pago" },
                      { label: "Facturas Vencidas", field: "notify_invoice_overdue", desc: "Alertas de cobranza" }
                    ].map((item) => (
                      <div key={item.field} className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-100 hover:border-cyan-200 transition-colors">
                        <div>
                          <p className="font-medium text-gray-900">{item.label}</p>
                          <p className="text-sm text-muted-foreground">{item.desc}</p>
                        </div>
                        <Switch
                          checked={settings[item.field as keyof OrganizationSettings] as boolean ?? true}
                          onCheckedChange={(checked) => updateField(item.field as keyof OrganizationSettings, checked)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="integrations" className="mt-0">
                <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md">
                  <CardHeader><CardTitle>Integraciones</CardTitle></CardHeader>
                  <CardContent className="p-8">
                    <div className="flex items-center justify-between p-4 border rounded-xl bg-green-50/50 border-green-100">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Database className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">Supabase Connected</p>
                          <p className="text-sm text-green-700">Base de datos operativa</p>
                        </div>
                      </div>
                      <Badge className="bg-green-500 text-white hover:bg-green-600">Activo</Badge>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="help" className="mt-0">
                <Card className="border-0 shadow-lg shadow-gray-200/40 bg-white/60 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-blue-500" /> Ayuda y Soporte
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="p-6 bg-white/80 rounded-2xl border border-gray-100 hover:shadow-lg transition-all">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                          <RotateCcw className="w-5 h-5 text-blue-600" />
                        </div>
                        <h4 className="font-bold mb-2">Tutoriales de Módulos</h4>
                        <p className="text-sm text-gray-500 mb-4">Reinicia los mensajes de ayuda que aparecen en cada sección.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            resetAllTutorials()
                            toast.success("Tutoriales reiniciados")
                          }}
                          className="w-full"
                        >
                          Reiniciar Todo
                        </Button>
                      </div>

                      <div className="p-6 bg-white/80 rounded-2xl border border-gray-100 hover:shadow-lg transition-all">
                        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                          <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <h4 className="font-bold mb-2">Tour de Bienvenida</h4>
                        <p className="text-sm text-gray-500 mb-4">Vuelve a ver nuestra guía inicial de introducción.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            resetWelcomeTour()
                            setTimeout(() => window.location.reload(), 1500)
                          }}
                          className="w-full"
                        >
                          Ver Tour
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}

