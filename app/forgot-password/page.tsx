"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion } from "framer-motion"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Mail, AlertCircle, ArrowLeft, Loader2, CheckCircle } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const supabaseRef = useRef<SupabaseClient | null>(null)

  useEffect(() => {
    import("@/lib/supabase-browser").then(({ getSupabaseBrowserClient }) => {
      supabaseRef.current = getSupabaseBrowserClient()
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const supabase = supabaseRef.current
    if (!supabase) {
      setError("Error de conexión")
      return
    }

    setLoading(true)
    setError("")

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (error) throw error
      setSuccess(true)
    } catch {
      setError("Error al enviar el email")
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
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Email Enviado</h1>
          <p className="text-gray-500 mb-8">
            Revisa tu bandeja de entrada en <span className="text-cyan-600 font-medium">{email}</span>
          </p>
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-4 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Login
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
          <Link href="/" className="flex justify-center mb-8">
            <div className="relative w-20 h-20">
              <Image src="/logo.png" alt="NEON SYSTEM" fill className="object-contain" sizes="80px" priority />
            </div>
          </Link>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">¿Olvidaste tu contraseña?</h1>
            <p className="text-gray-500 text-sm">Te enviaremos instrucciones por email</p>
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
                  disabled={loading}
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl font-semibold bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Enviar Instrucciones"
              )}
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
