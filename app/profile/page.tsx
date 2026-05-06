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
import { User, Mail, Phone, Building2, Lock, Bell, Loader2, Camera, Check, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { getSupabaseBrowserClient } from "@/lib/supabase-browser"
import { motion } from "framer-motion"
import Link from "next/link"

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
    if (!passwords.current) {
      toast.error("Ingresa tu contraseña actual")
      return
    }

    if (passwords.new !== passwords.confirm) {
      toast.error("Las contraseñas no coinciden")
      return
    }

    if (passwords.new.length < 10) {
      toast.error("La contraseña debe tener al menos 10 caracteres")
      return
    }

    setChangingPassword(true)
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwords.current,
          newPassword: passwords.new,
        }),
      })
      const json = await response.json()

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Error al cambiar contraseña")
      }

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
      <div className="max-w-4xl mx-auto space-y-8 pb-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <Link
            href="/settings"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-cyan-600 transition-colors w-fit"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Configuración
          </Link>

          <div className="space-y-1">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-gray-400 bg-clip-text text-transparent">
              Mi Perfil
            </h1>
            <p className="text-lg text-muted-foreground">
              Gestiona tu información personal y preferencias
            </p>
          </div>
        </motion.div>

        <Tabs defaultValue="profile" className="space-y-8">
          <TabsList className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-full border border-gray-200/50 dark:border-zinc-800/50 inline-flex h-auto shadow-sm">
            <TabsTrigger
              value="profile"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:text-white dark:text-gray-400 transition-all"
            >
              Perfil
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:text-white dark:text-gray-400 transition-all"
            >
              Seguridad
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="rounded-full px-6 py-2.5 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:text-white dark:text-gray-400 transition-all"
            >
              Notificaciones
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-0 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-lg shadow-gray-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
                  <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
                    <User className="w-5 h-5 text-cyan-500" />
                    Información Personal
                  </CardTitle>
                  <CardDescription>Actualiza tu información de perfil</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                  {/* Avatar */}
                  <div className="flex items-center gap-8">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-500 rounded-full blur opacity-25 group-hover:opacity-40 transition-opacity" />
                      <Avatar className="w-24 h-24 border-4 border-white dark:border-zinc-800 relative z-10 shadow-md">
                        <AvatarImage src={profile?.avatar_url || undefined} />
                        <AvatarFallback className="text-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-zinc-800 dark:to-zinc-700 text-gray-700 dark:text-gray-200">
                          {getInitials(profile?.full_name || null)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <Button variant="outline" size="sm" disabled className="mb-2 dark:bg-zinc-800 dark:border-zinc-700 dark:text-gray-300">
                        <Camera className="w-4 h-4 mr-2" />
                        Cambiar Foto
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG. Máximo 2MB.
                      </p>
                    </div>
                  </div>

                  {/* Form */}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre Completo</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500" />
                        <Input
                          id="name"
                          value={profile?.full_name || ""}
                          onChange={(e) => setProfile(prev => prev ? { ...prev, full_name: e.target.value } : null)}
                          className="pl-9 bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500 transition-all dark:text-gray-100"
                          placeholder="Tu nombre"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="email"
                          value={profile?.email || ""}
                          className="pl-9 bg-gray-50/50 dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-800 dark:text-gray-300"
                          disabled
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">El email no se puede cambiar</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500" />
                        <Input
                          id="phone"
                          value={profile?.phone || ""}
                          onChange={(e) => setProfile(prev => prev ? { ...prev, phone: e.target.value } : null)}
                          className="pl-9 bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500 transition-all dark:text-gray-100"
                          placeholder="+51 999 123 456"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="company">Empresa</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500" />
                        <Input
                          id="company"
                          value={profile?.company_name || ""}
                          onChange={(e) => setProfile(prev => prev ? { ...prev, company_name: e.target.value } : null)}
                          className="pl-9 bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500 transition-all dark:text-gray-100"
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
                        className="bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-cyan-500 focus:ring-cyan-500 transition-all dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button onClick={saveProfile} disabled={saving} className="gradient-neon border-0 text-white min-w-[150px] shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all">
                      {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Guardar Cambios
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-lg shadow-gray-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
                  <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
                    <Lock className="w-5 h-5 text-purple-500" />
                    Cambiar Contraseña
                  </CardTitle>
                  <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 p-8">
                  <div className="grid gap-6 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Contraseña Actual</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={passwords.current}
                        onChange={(e) => setPasswords(prev => ({ ...prev, current: e.target.value }))}
                        placeholder="Tu contraseña actual"
                        autoComplete="current-password"
                        className="bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-purple-500 transition-all dark:text-gray-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nueva Contraseña</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={passwords.new}
                        onChange={(e) => setPasswords(prev => ({ ...prev, new: e.target.value }))}
                        placeholder="Mínimo 10 caracteres"
                        autoComplete="new-password"
                        className="bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-purple-500 transition-all dark:text-gray-100"
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
                        autoComplete="new-password"
                        className="bg-white/50 dark:bg-zinc-900/50 border-gray-200 dark:border-zinc-800 focus:border-purple-500 focus:ring-purple-500 transition-all dark:text-gray-100"
                      />
                    </div>
                  </div>

                  <div className="flex justify-start pt-4">
                    <Button onClick={changePassword} disabled={changingPassword || !passwords.current || !passwords.new} className="bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-900/20">
                      {changingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Actualizar Contraseña
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-0 shadow-lg shadow-gray-200/40 dark:shadow-none bg-white/60 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden">
                <CardHeader className="border-b border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/20">
                  <CardTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
                    <Bell className="w-5 h-5 text-orange-500" />
                    Preferencias de Notificaciones
                  </CardTitle>
                  <CardDescription>Configura cómo quieres recibir notificaciones</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8 p-8">
                  <div className="space-y-6">
                    <h4 className="font-medium text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                      Notificaciones por Email
                    </h4>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 hover:bg-white/80 dark:hover:bg-zinc-800/50 transition-colors">
                      <div>
                        <p className="font-medium dark:text-gray-200">Nuevos Leads</p>
                        <p className="text-sm text-muted-foreground">Recibe un email cuando llegue un nuevo lead</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_new_lead}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_new_lead: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 hover:bg-white/80 dark:hover:bg-zinc-800/50 transition-colors">
                      <div>
                        <p className="font-medium dark:text-gray-200">Tareas Vencidas</p>
                        <p className="text-sm text-muted-foreground">Recordatorio de tareas próximas a vencer</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_task_due}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_task_due: checked }))}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 hover:bg-white/80 dark:hover:bg-zinc-800/50 transition-colors">
                      <div>
                        <p className="font-medium dark:text-gray-200">Pagos Recibidos</p>
                        <p className="text-sm text-muted-foreground">Notificación cuando se registre un pago</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.email_payment_received}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, email_payment_received: checked }))}
                      />
                    </div>
                  </div>

                  <div className="pt-6 border-t border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-gray-100 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/30 hover:bg-white/80 dark:hover:bg-zinc-800/50 transition-colors">
                      <div>
                        <p className="font-medium dark:text-gray-200">Notificaciones Push</p>
                        <p className="text-sm text-muted-foreground">Recibe notificaciones en el navegador</p>
                      </div>
                      <Switch
                        checked={notificationPrefs.push_enabled}
                        onCheckedChange={(checked) => setNotificationPrefs(prev => ({ ...prev, push_enabled: checked }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button variant="outline" disabled className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/30">
                      <Check className="w-4 h-4 mr-2" />
                      Guardado automáticamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
