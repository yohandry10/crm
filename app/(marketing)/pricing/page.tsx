"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Check, Zap, Building2, Users, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"

interface Plan {
  id: string
  name: string
  display_name: string
  description: string
  price_monthly: number
  price_yearly: number
  max_users: number
  max_contacts: number
  max_invoices_month: number
  features: string[]
}

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [isYearly, setIsYearly] = useState(false)

  useEffect(() => {
    loadPlans()
  }, [])

  const loadPlans = async () => {
    try {
      const res = await fetch("/api/public/plans")
      const json = await res.json()
      if (json.success) {
        setPlans(json.data.filter((p: Plan) => p.name !== "trial"))
      }
    } catch {
      // Fallback plans if API fails
      setPlans([
        {
          id: "1",
          name: "starter",
          display_name: "Starter",
          description: "Ideal para emprendedores y pequeños negocios",
          price_monthly: 99,
          price_yearly: 999,
          max_users: 3,
          max_contacts: 500,
          max_invoices_month: 100,
          features: ["3 usuarios", "500 contactos", "100 facturas/mes", "Soporte por email", "Reportes básicos"],
        },
        {
          id: "2",
          name: "professional",
          display_name: "Profesional",
          description: "Para equipos de ventas en crecimiento",
          price_monthly: 199,
          price_yearly: 1999,
          max_users: 10,
          max_contacts: 2000,
          max_invoices_month: 500,
          features: ["10 usuarios", "2000 contactos", "500 facturas/mes", "Soporte prioritario", "Reportes avanzados", "Workflows ilimitados", "API access"],
        },
        {
          id: "3",
          name: "enterprise",
          display_name: "Empresa",
          description: "Solución completa para grandes equipos",
          price_monthly: 499,
          price_yearly: 4999,
          max_users: 50,
          max_contacts: 10000,
          max_invoices_month: -1,
          features: ["50 usuarios", "10000 contactos", "Facturas ilimitadas", "Soporte 24/7", "Reportes personalizados", "Integraciones avanzadas", "SLA garantizado"],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number) => {
    return `S/ ${price.toLocaleString()}`
  }

  const getYearlySavings = (monthly: number, yearly: number) => {
    const monthlyTotal = monthly * 12
    const savings = monthlyTotal - yearly
    return Math.round((savings / monthlyTotal) * 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Zap className="w-8 h-8 text-cyan-500" />
              <span className="font-bold text-xl">CRM</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Iniciar Sesión</Button>
              </Link>
              <Link href="/signup">
                <Button>Comenzar Gratis</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge className="mb-4 bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
              Precios simples y transparentes
            </Badge>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Elige el plan perfecto para tu negocio
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Comienza con 2 días de prueba gratis. Sin tarjeta de crédito requerida.
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
              <span className={`text-sm font-medium ${!isYearly ? "text-gray-900" : "text-gray-500"}`}>
                Mensual
              </span>
              <Switch checked={isYearly} onCheckedChange={setIsYearly} />
              <span className={`text-sm font-medium ${isYearly ? "text-gray-900" : "text-gray-500"}`}>
                Anual
              </span>
              {isYearly && (
                <Badge className="bg-green-100 text-green-800">
                  Ahorra hasta 17%
                </Badge>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-500" />
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan, index) => {
                const price = isYearly ? plan.price_yearly : plan.price_monthly
                const isPopular = plan.name === "professional"

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className={`relative rounded-2xl border-2 p-8 bg-white ${
                      isPopular 
                        ? "border-cyan-500 shadow-xl shadow-cyan-500/10" 
                        : "border-gray-200"
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-4 py-1">
                          Más Popular
                        </Badge>
                      </div>
                    )}

                    <div className="text-center mb-8">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {plan.display_name}
                      </h3>
                      <p className="text-gray-500 text-sm mb-6">
                        {plan.description}
                      </p>
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-5xl font-bold text-gray-900">
                          {formatPrice(price)}
                        </span>
                        <span className="text-gray-500">
                          /{isYearly ? "año" : "mes"}
                        </span>
                      </div>
                      {isYearly && (
                        <p className="text-sm text-green-600 mt-2">
                          Ahorras {getYearlySavings(plan.price_monthly, plan.price_yearly)}% vs mensual
                        </p>
                      )}
                    </div>

                    <ul className="space-y-4 mb-8">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-3">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    <Link href="/signup" className="block">
                      <Button 
                        className={`w-full ${
                          isPopular 
                            ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700" 
                            : ""
                        }`}
                        variant={isPopular ? "default" : "outline"}
                        size="lg"
                      >
                        Comenzar Prueba Gratis
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Features Comparison */}
      <section className="py-20 px-4 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Todo lo que necesitas para crecer
          </h2>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Users, title: "Gestión de Contactos", desc: "Organiza y segmenta todos tus clientes y prospectos" },
              { icon: Building2, title: "Pipeline de Ventas", desc: "Visualiza y gestiona tu embudo de ventas con Kanban" },
              { icon: Zap, title: "Automatizaciones", desc: "Workflows automáticos para tareas repetitivas" },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="w-12 h-12 rounded-xl bg-cyan-100 flex items-center justify-center mx-auto mb-4">
                  <feature.icon className="w-6 h-6 text-cyan-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            ¿Listo para impulsar tus ventas?
          </h2>
          <p className="text-gray-600 mb-8">
            Únete a cientos de empresas que ya usan nuestro CRM para crecer.
          </p>
          <Link href="/signup">
            <Button size="lg" className="bg-gradient-to-r from-cyan-500 to-blue-600">
              Comenzar Prueba Gratis de 2 Días
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Sin tarjeta de crédito • Configuración en 2 minutos
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-cyan-500" />
            <span className="font-semibold">CRM</span>
          </div>
          <p className="text-sm text-gray-500">
            © {new Date().getFullYear()} CRM. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  )
}
