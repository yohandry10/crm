"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Box,
  Check,
  FileText,
  Loader2,
  ShieldCheck,
  Users,
  WalletCards,
} from "lucide-react"

const modules = [
  {
    title: "Contabilidad automatizada",
    description: "Asientos, balances y resultados con datos iniciales listos para revisar.",
    icon: BarChart3,
  },
  {
    title: "Facturación electrónica",
    description: "Facturas, boletas, notas y validaciones fiscales en modo demostración.",
    icon: FileText,
  },
  {
    title: "Inventario y kardex",
    description: "Productos, movimientos y stock de prueba para flujos operativos.",
    icon: Box,
  },
  {
    title: "POS multi-caja",
    description: "Ventas rápidas, sesiones de caja y métodos de pago configurados.",
    icon: WalletCards,
  },
  {
    title: "Seguridad por roles",
    description: "Tenant aislado con usuario owner demo y permisos operativos.",
    icon: ShieldCheck,
  },
  {
    title: "RRHH y tareas",
    description: "Tareas, calendario y actividad diaria para validar procesos.",
    icon: Users,
  },
]

const countries = [
  { value: "PE", label: "Perú · SUNAT · PEN" },
]

export default function DemoPage() {
  const [countryCode, setCountryCode] = useState("PE")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null)

  async function startDemo() {
    setLoading(true)
    setError("")
    setCredentials(null)

    try {
      const response = await fetch("/api/demo/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countryCode }),
      })

      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.details || payload?.error || "No se pudo crear la demo")
      }

      const demoCredentials = payload.data?.credentials
      if (!demoCredentials?.email || !demoCredentials?.password) {
        throw new Error("La demo no devolvió credenciales de acceso")
      }

      setCredentials(demoCredentials)

      const { getSupabaseBrowserClient } = await import("@/lib/supabase-browser")
      const supabase = getSupabaseBrowserClient()
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: demoCredentials.email,
        password: demoCredentials.password,
      })

      if (loginError) {
        throw new Error("La demo fue creada, pero no se pudo iniciar sesión automáticamente. Usa las credenciales mostradas.")
      }

      window.location.assign(payload.data?.redirectTo || "/dashboard?demo=1")
    } catch (err: any) {
      setError(err?.message || "No se pudo crear la demo")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-950">
      <section className="mx-auto grid min-h-screen w-full max-w-6xl items-center gap-8 px-6 py-12 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3 py-1 text-sm font-medium text-blue-700 shadow-sm">
            <BarChart3 className="h-4 w-4" />
            ERP Suite Demo
          </div>

          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-normal text-slate-950 md:text-5xl">
            Prueba el ERP completo con una empresa demo operativa
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
            Se crea un tenant aislado por 14 días con usuario owner, datos iniciales y acceso a los módulos principales.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon
              return (
                <article key={module.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h2 className="text-base font-semibold text-slate-950">{module.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{module.description}</p>
                </article>
              )
            })}
          </div>
        </div>

        <aside className="rounded-lg border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-md bg-blue-100 text-blue-700">
            <Check className="h-6 w-6" />
          </div>

          <h2 className="text-2xl font-bold text-slate-950">Listo para explorar</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Crearemos una empresa demo de Perú, con PEN, reglas de SUNAT y credenciales temporales.
          </p>

          <label htmlFor="demo-country" className="mt-6 block text-sm font-semibold text-slate-700">
            País de la demo
          </label>
          <select
            id="demo-country"
            value={countryCode}
            onChange={(event) => setCountryCode(event.target.value)}
            disabled={loading}
            className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60"
          >
            {countries.map((country) => (
              <option key={country.value} value={country.value}>
                {country.label}
              </option>
            ))}
          </select>

          {error && (
            <div className="mt-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}

          {credentials && (
            <div className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
              <p className="font-semibold">Credenciales demo creadas</p>
              <p className="break-all">Email: {credentials.email}</p>
              <p className="break-all">Contraseña: {credentials.password}</p>
            </div>
          )}

          <button
            type="button"
            onClick={startDemo}
            disabled={loading}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando demo
              </>
            ) : (
              <>
                Iniciar demo ahora
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>

          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              No requiere registro previo
            </p>
            <p className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              Acceso inmediato al dashboard
            </p>
            <p className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-600" />
              Datos de ejemplo incluidos
            </p>
          </div>

          <p className="mt-8 text-center text-sm text-slate-500">
            Ya tienes una cuenta?{" "}
            <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
              Inicia sesión
            </Link>
          </p>
        </aside>
      </section>
    </main>
  )
}
