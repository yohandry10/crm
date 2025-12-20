"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Mail, Lock, User, Building2, AlertCircle, ArrowRight, Loader2, CheckCircle, Shield } from "lucide-react"

interface Invitation {
  id: string
  email: string
  role: string
  organization_id: string
  organizations: { name: string } | { name: string }[]
}

export default function SignupPage() {
  const searchParams = useSearchParams()
  const inviteToken = searchParams?.get("token")
  const loginRedirectUrl = inviteToken ? `/login?redirect=${encodeURIComponent(`/signup?token=${inviteToken}`)}` : "/login"
  
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    companyName: "",
  })
  const [loading, setLoading] = useState(false)
  const [loadingInvite, setLoadingInvite] = useState(!!inviteToken)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [requiresLoginToAccept, setRequiresLoginToAccept] = useState(false)
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ getSupabaseBrowserClient }) => {
      supabaseRef.current = getSupabaseBrowserClient()
      if (inviteToken) {
        validateInvitation(getSupabaseBrowserClient())
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inviteToken])

  const validateInvitation = async (supabase: SupabaseClient) => {
    try {
      const res = await fetch("/api/invitations/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok || !json?.data) {
        setError("Invitación inválida o expirada")
        setLoadingInvite(false)
        return
      }

      setInvitation(json.data as Invitation)
      setFormData(prev => ({ ...prev, email: json.data.email }))

      const { data: session } = await supabase.auth.getSession()
      if (session?.session?.user) {
        if (inviteToken) await acceptInvitation(inviteToken)
      }
    } catch {
      setError("Error al validar invitación")
    } finally {
      setLoadingInvite(false)
    }
  }

  const acceptInvitation = async (token: string) => {
    setLoading(true)
    setError("")
    setRequiresLoginToAccept(false)

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 401) {
          setRequiresLoginToAccept(true)
          setError("Inicia sesión para aceptar la invitación")
          return
        }
        setError(json?.error || "No se pudo aceptar la invitación")
        return
      }

      setSuccess(true)
    } catch {
      setError("No se pudo aceptar la invitación")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setRequiresLoginToAccept(false)

    if (formData.password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setError("Las contraseñas no coinciden")
      return
    }

    const supabase = supabaseRef.current
    if (!supabase) {
      setError("Error de conexión")
      return
    }

    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { full_name: formData.fullName, company_name: formData.companyName },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        if (authError.message.toLowerCase().includes("already registered")) {
          setRequiresLoginToAccept(!!inviteToken)
          setError(inviteToken ? "Este email ya existe. Inicia sesión para aceptar la invitación." : "Este email ya está registrado")
          return
        }
        setError(authError.message)
        return
      }

      if (authData.user) {
        // Create profile
        await supabase.from("profiles").upsert({
          id: authData.user.id,
          email: formData.email,
          full_name: formData.fullName,
          company_name: formData.companyName,
          role: "user",
          current_organization_id: invitation?.organization_id || null,
        })
      }

      if (inviteToken) {
        await acceptInvitation(inviteToken)
        return
      }

      setSuccess(true)
    } catch {
      setError("Error al crear la cuenta")
    } finally {
      setLoading(false)
    }
  }

  if (loadingInvite) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-cyan-500" />
          <p className="mt-4 text-gray-500">Validando invitación...</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-xl p-10 text-center max-w-md border border-gray-100"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center"
          >
            <CheckCircle className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">¡Cuenta Creada!</h1>
          <p className="text-gray-500 mb-8">
            {invitation ? (
              <>Te has unido a <span className="text-cyan-600 font-medium">{Array.isArray(invitation.organizations) ? invitation.organizations[0]?.name : invitation.organizations.name}</span></>
            ) : (
              <>Enviamos un email de confirmación a <span className="text-cyan-600 font-medium">{formData.email}</span></>
            )}
          </p>
          <Link href={invitation ? "/onboarding" : "/login"}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25"
            >
              {invitation ? "Continuar al CRM" : "Ir a Iniciar Sesión"}
            </motion.button>
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 p-8 sm:p-10 border border-gray-100">
          {/* Logo */}
          <Link href="/" className="flex justify-center mb-6">
            <div className="relative w-20 h-20">
              <Image src="/logo.png" alt="NEON SYSTEM" fill className="object-contain" sizes="80px" priority />
            </div>
          </Link>

          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {invitation ? "Acepta tu Invitación" : "Crear Cuenta"}
            </h1>
            <p className="text-gray-500 text-sm">
              {invitation 
                ? `Te invitaron a unirte a ${Array.isArray(invitation.organizations) ? invitation.organizations[0]?.name : invitation.organizations.name}`
                : "Comienza gratis, sin tarjeta"
              }
            </p>
          </div>

          {invitation && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-cyan-50 border border-cyan-100 mb-6">
              <Shield className="w-5 h-5 text-cyan-600 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-cyan-800 font-medium">Invitación válida</p>
                <p className="text-cyan-600">Rol: {invitation.role}</p>
              </div>
            </div>
          )}

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-6"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </motion.div>
          )}

          {requiresLoginToAccept && (
            <div className="mb-6">
              <Link href={loginRedirectUrl} className="block">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3 rounded-xl font-semibold bg-gray-900 text-white"
                >
                  Iniciar sesión para aceptar
                </motion.button>
              </Link>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="Juan Pérez"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all disabled:bg-gray-100"
                  placeholder="tu@email.com"
                  required
                  disabled={loading || !!invitation}
                />
              </div>
            </div>

            {!invitation && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Empresa (opcional)</label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                    placeholder="Mi Empresa"
                    disabled={loading}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="Repite tu contraseña"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {invitation ? "Aceptar Invitación" : "Crear Cuenta Gratis"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="text-cyan-600 hover:text-cyan-700 font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
