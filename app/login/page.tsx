"use client"

import { useState, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Mail, Lock, AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [isBlocked, setIsBlocked] = useState(false)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  const searchParams = useSearchParams()
  const redirect = searchParams?.get("redirect") || "/dashboard"

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ getSupabaseBrowserClient }) => {
      supabaseRef.current = getSupabaseBrowserClient()
    })
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) setIsBlocked(true)
        setError(data.error || "Error al iniciar sesión")
        return
      }

      const supabase = supabaseRef.current
      if (supabase) {
        await supabase.auth.getSession()
      }
      
      toast.success("¡Bienvenido!")
      
      // Redirigir según tipo de usuario
      if (data.user.isPlatformAdmin) {
        window.location.href = "/admin"
      } else {
        window.location.href = redirect
      }
    } catch {
      setError("Error de conexión")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const supabase = supabaseRef.current
    if (!supabase) return
    setLoading(true)
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}` }
      })
    } catch {
      setError("Error con Google")
      setLoading(false)
    }
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
          <Link href="/" className="flex justify-center mb-8">
            <div className="relative w-20 h-20">
              <Image src="/logo.png" alt="NEON SYSTEM" fill className="object-contain" priority />
            </div>
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Bienvenido</h1>
            <p className="text-gray-500 text-sm">Inicia sesión en tu cuenta</p>
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

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="tu@email.com"
                  required
                  disabled={loading || isBlocked}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">Contraseña</label>
                <Link href="/forgot-password" className="text-sm text-cyan-600 hover:text-cyan-700">
                  ¿Olvidaste?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3.5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 transition-all"
                  placeholder="••••••••"
                  required
                  disabled={loading || isBlocked}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading || isBlocked}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Iniciar Sesión
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">o continúa con</span>
            </div>
          </div>

          <motion.button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || isBlocked}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span className="text-gray-700">Google</span>
          </motion.button>

          <p className="text-center text-sm text-gray-500 mt-8">
            ¿No tienes cuenta?{" "}
            <Link href="/signup" className="text-cyan-600 hover:text-cyan-700 font-medium">
              Regístrate gratis
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
