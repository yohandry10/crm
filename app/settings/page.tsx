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
import { Settings, User, Bell, Database, Key, Phone, Building, Loader2, Users, CreditCard, ArrowRight, HelpCircle, RotateCcw, Eye, EyeOff, Lock } from "lucide-react"
import { toast } from "sonner"
import { resetAllTutorials, resetWelcomeTour } from "@/components/tutorials"

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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Configuraciones</h1>
            <p className="text-muted-foreground">Gestiona la configuración de tu sistema y cuenta</p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/settings/team">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium">Equipo</p>
                    <p className="text-sm text-muted-foreground">Gestionar miembros</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/settings/billing">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium">Suscripción</p>
                    <p className="text-sm text-muted-foreground">Plan y facturación</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>

          <Link href="/profile">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="font-medium">Mi Perfil</p>
                    <p className="text-sm text-muted-foreground">Cuenta y seguridad</p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="billing">Facturación</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="integrations">Integraciones</TabsTrigger>
            <TabsTrigger value="help">Ayuda</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="w-5 h-5" />
                      Información de la Empresa
                    </CardTitle>
                    <CardDescription>Datos configurados durante el registro. Puedes editarlos aquí.</CardDescription>
                  </div>
                  {settings.company_name && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Datos registrados
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nombre de la Empresa</Label>
                    <Input
                      value={settings.company_name || ""}
                      onChange={(e) => updateField("company_name", e.target.value)}
                      placeholder="Ingresa el nombre de tu empresa"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>RUC</Label>
                    <Input
                      value={settings.company_ruc || ""}
                      onChange={(e) => updateField("company_ruc", e.target.value)}
                      maxLength={11}
                      placeholder="20123456789"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Dirección</Label>
                    <Input
                      value={settings.company_address || ""}
                      onChange={(e) => updateField("company_address", e.target.value)}
                      placeholder="Av. Principal 123, Lima"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={settings.company_phone || ""}
                      onChange={(e) => updateField("company_phone", e.target.value)}
                      placeholder="+51 999 123 456"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={settings.company_email || ""}
                      onChange={(e) => updateField("company_email", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Zona Horaria</Label>
                    <Select
                      value={settings.timezone || "America/Lima"}
                      onValueChange={(v) => updateField("timezone", v)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="America/Lima">America/Lima (UTC-5)</SelectItem>
                        <SelectItem value="America/Bogota">America/Bogota (UTC-5)</SelectItem>
                        <SelectItem value="America/Mexico_City">America/Mexico_City (UTC-6)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (UTC-5)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={saveSettings}
                  disabled={saving || !hasChanges()}
                  className={hasChanges() ? "gradient-neon border-0" : ""}
                  variant={hasChanges() ? "default" : "secondary"}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {hasChanges() ? "Guardar Cambios" : "Sin cambios pendientes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuración de Facturación
                </CardTitle>
                <CardDescription>Series y configuración para comprobantes electrónicos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Serie Factura</Label>
                    <Input
                      value={settings.serie_factura || ""}
                      onChange={(e) => updateField("serie_factura", e.target.value.toUpperCase())}
                      placeholder="F001"
                      maxLength={4}
                    />
                    <p className="text-xs text-muted-foreground">Formato: F + 3 dígitos</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Serie Boleta</Label>
                    <Input
                      value={settings.serie_boleta || ""}
                      onChange={(e) => updateField("serie_boleta", e.target.value.toUpperCase())}
                      placeholder="B001"
                      maxLength={4}
                    />
                    <p className="text-xs text-muted-foreground">Formato: B + 3 dígitos</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Serie Nota de Crédito</Label>
                    <Input
                      value={settings.serie_nota_credito || ""}
                      onChange={(e) => updateField("serie_nota_credito", e.target.value.toUpperCase())}
                      placeholder="FC01"
                      maxLength={4}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Moneda Principal</Label>
                    <Select
                      value={settings.default_currency || "PEN"}
                      onValueChange={(v) => updateField("default_currency", v)}
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
                      value={settings.default_tax_rate ?? ""}
                      onChange={(e) => updateField("default_tax_rate", e.target.value ? Number(e.target.value) : null)}
                      placeholder="18"
                      min={0}
                      max={100}
                    />
                  </div>
                </div>
                <Button
                  onClick={saveSettings}
                  disabled={saving || !hasChanges()}
                  className={hasChanges() ? "gradient-neon border-0" : ""}
                  variant={hasChanges() ? "default" : "secondary"}
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {hasChanges() ? "Guardar Cambios" : "Sin cambios pendientes"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <SecuritySettings />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Preferencias de Notificaciones
                </CardTitle>
                <CardDescription>Configura qué notificaciones deseas recibir</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Nuevos Leads</p>
                      <p className="text-sm text-muted-foreground">Notificar cuando lleguen nuevos leads</p>
                    </div>
                    <Switch
                      checked={settings.notify_new_lead ?? true}
                      onCheckedChange={(checked) => updateField("notify_new_lead", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Tareas Vencidas</p>
                      <p className="text-sm text-muted-foreground">Alertas de tareas próximas a vencer</p>
                    </div>
                    <Switch
                      checked={settings.notify_task_due ?? true}
                      onCheckedChange={(checked) => updateField("notify_task_due", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Pagos Recibidos</p>
                      <p className="text-sm text-muted-foreground">Notificar cuando se registre un pago</p>
                    </div>
                    <Switch
                      checked={settings.notify_payment_received ?? true}
                      onCheckedChange={(checked) => updateField("notify_payment_received", checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Facturas Vencidas</p>
                      <p className="text-sm text-muted-foreground">Alertas de facturas sin pagar</p>
                    </div>
                    <Switch
                      checked={settings.notify_invoice_overdue ?? true}
                      onCheckedChange={(checked) => updateField("notify_invoice_overdue", checked)}
                    />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Los cambios en notificaciones se guardan junto con los demás ajustes.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  APIs y Integraciones
                </CardTitle>
                <CardDescription>Estado de las conexiones externas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <Database className="w-4 h-4 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">Supabase</p>
                        <p className="text-sm text-muted-foreground">Base de datos y autenticación</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Conectado</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <Key className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">OpenAI</p>
                        <p className="text-sm text-muted-foreground">Inteligencia artificial</p>
                      </div>
                    </div>
                    <Badge className="bg-green-100 text-green-800">Conectado</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <Phone className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium">WhatsApp Business</p>
                        <p className="text-sm text-muted-foreground">Mensajería automática</p>
                      </div>
                    </div>
                    <Badge variant="outline">No configurado</Badge>
                  </div>
                </div>
                <Button variant="outline" onClick={() => window.location.href = '/integrations'}>
                  Gestionar Integraciones
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="help" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5" />
                  Tutoriales y Ayuda
                </CardTitle>
                <CardDescription>Aprende a usar todas las funciones del CRM</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Tutoriales de Módulos</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Cada módulo del CRM tiene un botón de ayuda (?) que muestra un tutorial paso a paso
                    explicando cómo funciona y cómo se conecta con otros módulos.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetAllTutorials()
                      toast.success("Tutoriales reiniciados. Verás el indicador de 'Ver Tutorial' en cada módulo.")
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Reiniciar Tutoriales de Módulos
                  </Button>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium mb-2">Tour de Bienvenida</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    El tour de bienvenida te da una introducción general a todas las funciones del CRM.
                    Puedes verlo nuevamente si lo deseas.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetWelcomeTour()
                      toast.success("Tour reiniciado. Recarga la página para verlo.")
                      setTimeout(() => window.location.reload(), 1500)
                    }}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Ver Tour de Bienvenida
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-medium mb-2">¿Necesitas más ayuda?</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Si tienes dudas o problemas, puedes contactar a nuestro equipo de soporte.
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" asChild>
                      <a href="mailto:soporte@tucrm.com">Enviar Email</a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href="https://wa.me/51999999999" target="_blank" rel="noopener noreferrer">
                        WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
