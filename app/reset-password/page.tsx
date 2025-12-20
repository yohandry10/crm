"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Lock, AlertCircle, CheckCircle, ArrowLeft, Loader2 } from "lucide-react"
import { useSearchParams, useRouter } from "next/navigation"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams?.get("code")
  const errorParam = searchParams?.get("error")
  const errorCode = searchParams?.get("error_code")
  const errorDescription = searchParams?.get("error_description")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ getSupabaseBrowserClient }) => {
      supabaseRef.current = getSupabaseBrowserClient()
      if (errorParam || errorCode || errorDescription) {
        setError(mapAuthError(errorCode, errorDescription))
        setSessionReady(false)
        return
      }
      if (code) {
        exchangeCode(code)
      } else {
        handleRecoveryFromUrl()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, errorParam, errorCode, errorDescription])

  const mapAuthError = (codeValue?: string | null, description?: string | null) => {
    if (codeValue === "otp_expired") {
      return "El link de recuperación expiró. Solicita uno nuevo."
    }
    if (description) {
      return decodeURIComponent(description.replace(/\+/g, " "))
    }
    return "El link de recuperación es inválido o expiró"
  }

  const getHashParams = () => {
    if (typeof window === "undefined") return null
    const hash = window.location.hash || ""
    if (!hash.startsWith("#")) return null
    const params = new URLSearchParams(hash.slice(1))
    return {
      accessToken: params.get("access_token"),
      refreshToken: params.get("refresh_token"),
      expiresIn: params.get("expires_in"),
      tokenType: params.get("token_type"),
    }
  }

  const handleRecoveryFromUrl = async () => {
    const supabase = supabaseRef.current
    if (!supabase) return
    const hashParams = getHashParams()
    if (hashParams?.accessToken && hashParams?.refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: hashParams.accessToken,
        refresh_token: hashParams.refreshToken,
      })
      if (error) {
        setError(mapAuthError(error.code as string | null, error.message || null))
        setSessionReady(false)
        return
      }
      setSessionReady(true)
      return
    }
    await checkExistingSession()
  }

  const checkExistingSession = async () => {
    const supabase = supabaseRef.current
    if (!supabase) return
    const { data } = await supabase.auth.getSession()
    if (data?.session) {
      setSessionReady(true)
    } else {
      setError("Abre el link de recuperación desde tu email.")
      setSessionReady(false)
    }
  }

  const exchangeCode = async (authCode: string) => {
    try {
      const supabase = supabaseRef.current
      if (!supabase) return
      const { error } = await supabase.auth.exchangeCodeForSession(authCode)
      if (error) {
        setError(mapAuthError(error.code as string | null, error.message || null))
        return
      }
      setSessionReady(true)
    } catch {
      setError("No se pudo validar el link de recuperación")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres")
      return
    }
    if (password !== confirmPassword) {
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
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        throw error
      }
      setSuccess(true)
      setTimeout(() => router.push("/login"), 1500)
    } catch (err: any) {
      setError(err?.message || "No se pudo actualizar la contraseña")
    } finally {
      setLoading(false)
    }
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
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Contraseña actualizada</h1>
          <p className="text-gray-500 mb-8">Ya puedes iniciar sesión con tu nueva contraseña.</p>
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Ir al Login
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
          <Link href="/" className="flex justify-center mb-8">
            <div className="relative w-20 h-20">
              <Image src="/logo.png" alt="NEON SYSTEM" fill className="object-contain" sizes="80px" priority />
            </div>
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Restablecer contraseña</h1>
            <p className="text-gray-500 text-sm">Ingresa tu nueva contraseña</p>
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Nueva contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="Mínimo 8 caracteres"
                  required
                  minLength={8}
                  disabled={loading || !sessionReady}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirmar contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="Repite tu contraseña"
                  required
                  minLength={8}
                  disabled={loading || !sessionReady}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading || !sessionReady}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Actualizar contraseña"}
            </motion.button>
          </form>

          <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 mt-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Volver al Login
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
