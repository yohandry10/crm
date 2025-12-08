"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { User, Mail, Phone, Building2, Lock, Bell, Loader2, Camera, Check } from "lucide-react"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"

interface Profile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
  company_name: string | null
  job_title: string | null
}

interface NotificationPrefs {
  email_new_lead: boolean
  email_task_due: boolean
  email_payment_received: boolean
  push_enabled: boolean
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    email_new_lead: true,
    email_task_due: true,
    email_payment_received: true,
    push_enabled: false,
  })
  const [passwords, setPasswords] = useState({
    current: "",
    new: "",
    confirm: "",
  })
  const [supabase, setSupabase] = useState<ReturnType<typeof getSupabaseBrowserClient> | null>(null)

  useEffect(() => {
    setSupabase(getSupabaseBrowserClient())
  }, [])

  useEffect(() => {
    if (supabase) loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  const loadProfile = async () => {
    if (!supabase) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      if (data) {
        setProfile({
          id: data.id,
          email: data.email || user.email || "",
          full_name: data.full_name,
          phone: data.phone,
          avatar_url: data.avatar_url,
          company_name: data.company_name,
          job_title: data.job_title,
        })
      }
    } catch (error) {
      console.error("Error loading profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    if (!profile) return

    setSaving(true)
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: profile.full_name,
          phone: profile.phone,
          company_name: profile.company_name,
          job_title: profile.job_title,
        }),
      })

      const json = await res.json()
      if (json.success) {
        toast.success("Perfil actualizado")
      } else {
        throw new Error(json.error)
      }
    } catch (error: any) {
      toast.error(error.message || "Error al guardar")
    } finally {
      setSaving(false)
    }
  }

  const changePassword = async () => {
    if (!supabase) return
    if (passwords.new !== passwords.confirm) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    if (passwords.new.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres")
      return
    }

    setChangingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.new,
      })

      if (error) throw error

      toast.success("Contraseña actualizada")
      setPasswords({ current: "", new: "", confirm: "" })
    } catch (error: any) {
      toast.error(error.message || "Error al cambiar contraseña")
    } finally {
      setChangingPassword(false)
    }
  }

  const getInitials = (name: string | null) => {
    if (!name) return "U"
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
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
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold">Mi Perfil</h1>
          <p className="text-muted-foreground">Gestiona tu información personal y preferencias</p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList>
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="security">Seguridad</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Información Personal</CardTitle>
                <CardDescription>Actualiza tu información de perfil</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar */}
                <div className="flex items-center gap-6">
                  <Avatar className="w-20 h-20">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="text-xl bg-primary/10 text-primary">
                      {getInitials(profile?.full_name || null)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Button variant="outline" size="sm" disabled>
                      <Camera className="w-4 h-4 mr-2" />
                      Cambiar Foto
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      JPG, PNG. Máximo 2MB.
                    </p>
                  </div>
                </div>

                {/* Form */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="name"
                        value={profile?.full_name || ""}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                        className="pl-9"
                        placeholder="Tu nombre"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        value={profile?.email || ""}
                        className="pl-9 bg-muted"
                        disabled
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        value={profile?.phone || ""}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        className="pl-9"
                        placeholder="+51 999 123 456"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="company">Empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="company"
                        value={profile?.company_name || ""}
                        onChange={(e) => setProfile(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                        className="pl-9"
                        placeholder="Tu empresa"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="job">Cargo</Label>
                    <Input
                      id="job"
                      value={profile?.job_title || ""}
                      onChange={(e) => setProfile(prev => prev ? { ...prev, job_title: e.target.value } : null)}
                      placeholder="Ej: Gerente de Ventas"
                    />
                  </div>
                </div>

                <Button onClick={saveProfile} disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar Cambios
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security">
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
                  <Label htmlFor="new-password">Nueva Contraseña</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwords.new}
                    onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords(prev => ({ ...prev, confirm: e.target.value }))}
                    placeholder="Repite la contraseña"
                  />
                </div>

                <Button onClick={changePassword} disabled={changingPassword || !passwords.new}>
                  {changingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Cambiar Contraseña
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5" />
                  Preferencias de Notificaciones
                </CardTitle>
                <CardDescription>Configura cómo quieres recibir notificaciones</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Notificaciones por Email</h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Nuevos Leads</p>
                      <p className="text-sm text-muted-foreground">Recibe un email cuando llegue un nuevo lead</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.email_new_lead}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_new_lead: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Tareas Vencidas</p>
                      <p className="text-sm text-muted-foreground">Recordatorio de tareas próximas a vencer</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.email_task_due}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_task_due: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Pagos Recibidos</p>
                      <p className="text-sm text-muted-foreground">Notificación cuando se registre un pago</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.email_payment_received}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_payment_received: checked }))}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">Notificaciones Push</p>
                      <p className="text-sm text-muted-foreground">Recibe notificaciones en el navegador</p>
                    </div>
                    <Switch
                      checked={notificationPrefs.push_enabled}
                      onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, push_enabled: checked }))}
                    />
                  </div>
                </div>

                <Button variant="outline" disabled>
                  <Check className="w-4 h-4 mr-2" />
                  Guardado automáticamente
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
