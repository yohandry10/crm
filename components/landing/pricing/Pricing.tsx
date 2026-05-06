"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Check, ArrowRight, Loader2 } from "lucide-react"
import { Switch } from "@/components/ui/switch"

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

export function Pricing() {
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
                    price_monthly: 49,
                    price_yearly: 490,
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
                    price_monthly: 99,
                    price_yearly: 990,
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
                    price_monthly: 199,
                    price_yearly: 1990,
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

    return (
        <section id="precios" className="py-24 bg-white relative overflow-hidden">
            {/* Decorative Grid for White Background */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_center,black_60%,transparent_100%)] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <div className="max-w-4xl mx-auto text-center mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5 }}
                    >
                        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 mb-6 tracking-tight">
                            Inversión que <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-600 to-black">se paga sola.</span>
                        </h2>
                        <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto font-medium">
                            Tecnología de nivel empresarial diseñada para maximizar tu rentabilidad desde el primer día.
                        </p>

                        {/* Billing Toggle */}
                        <div className="flex items-center justify-center gap-4">
                            <span className={`text-sm font-medium ${!isYearly ? "text-gray-900" : "text-gray-500"}`}>
                                Mensual
                            </span>
                            <Switch
                                checked={isYearly}
                                onCheckedChange={setIsYearly}
                                className="data-[state=checked]:bg-black data-[state=unchecked]:bg-gray-200"
                            />
                            <span className={`text-sm font-medium ${isYearly ? "text-gray-900" : "text-gray-500"}`}>
                                Anual
                            </span>
                            {isYearly && (
                                <span className="text-xs font-bold text-white bg-black px-2 py-0.5 rounded-full">
                                    -17% OFF
                                </span>
                            )}
                        </div>
                    </motion.div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
                    </div>
                ) : (
                    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                        {plans.map((plan, index) => {
                            const price = isYearly ? plan.price_yearly : plan.price_monthly
                            const isPopular = plan.name === "professional"

                            return (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.5, delay: index * 0.1 }}
                                    className={`relative rounded-3xl p-8 flex flex-col ${isPopular
                                        ? "bg-black text-white shadow-2xl shadow-gray-200"
                                        : "bg-white text-gray-900 border border-gray-100 hover:border-gray-200 hover:shadow-xl transition-all"
                                        }`}
                                >
                                    <div className="mb-8">
                                        <h3 className={`text-lg font-semibold mb-2 ${isPopular ? "text-white" : "text-gray-900"}`}>
                                            {plan.display_name}
                                        </h3>
                                        <p className={`text-sm mb-6 ${isPopular ? "text-gray-400" : "text-gray-500"}`}>
                                            {plan.description}
                                        </p>
                                        <div className="flex items-baseline gap-1">
                                            <span className={`text-5xl font-bold tracking-tight ${isPopular ? "text-white" : "text-gray-900"}`}>
                                                {formatPrice(price)}
                                            </span>
                                            <span className={isPopular ? "text-gray-400" : "text-gray-500"}>
                                                /{isYearly ? "año" : "mes"}
                                            </span>
                                        </div>
                                    </div>

                                    <ul className="space-y-4 mb-8 flex-1">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-start gap-3">
                                                <Check className={`w-5 h-5 flex-shrink-0 ${isPopular ? "text-white" : "text-gray-900"}`} />
                                                <span className={`text-sm ${isPopular ? "text-gray-300" : "text-gray-600"}`}>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <a href="/signup" className="block mt-auto">
                                        <button
                                            className={`w-full py-4 px-6 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${isPopular
                                                ? "bg-white text-black hover:bg-gray-200"
                                                : "bg-black text-white hover:bg-gray-800"
                                                }`}
                                        >
                                            Comenzar Ahora
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </a>
                                </motion.div>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}
