"use client"

import { motion } from "framer-motion"
import { BarChart3, Users, Zap, Shield, Layers, Bot } from "lucide-react"

export function Features() {
    const features = [
        { icon: Users, title: "CRM Inteligente", desc: "Gestión de contactos con scoring IA", gradient: "from-cyan-500 to-blue-600" },
        { icon: BarChart3, title: "Analytics", desc: "Predicciones en tiempo real", gradient: "from-violet-500 to-purple-600" },
        { icon: Zap, title: "Automatización", desc: "Workflows sin código", gradient: "from-amber-500 to-orange-600" },
        { icon: Shield, title: "Seguridad", desc: "Encriptación enterprise", gradient: "from-emerald-500 to-teal-600" },
        { icon: Layers, title: "Integraciones", desc: "50+ apps conectadas", gradient: "from-pink-500 to-rose-600" },
        { icon: Bot, title: "Asistente IA", desc: "Chatbot 24/7", gradient: "from-blue-500 to-indigo-600" },
    ]

    return (
        <section id="caracteristicas" className="py-24 bg-gray-50/50 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,transparent)] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-16"
                >
                    <span className="text-cyan-600 text-sm font-semibold tracking-widest uppercase">Características</span>
                    <h2 className="text-4xl sm:text-5xl font-bold mt-3 text-gray-900">Todo lo que necesitas</h2>
                    <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
                        Una suite completa de herramientas diseñadas para potenciar cada aspecto de tu negocio.
                    </p>
                </motion.div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: i * 0.1 }}
                            className="group p-8 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 hover:border-cyan-100 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300"
                        >
                            <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300 shadow-md`}>
                                <feature.icon className="w-7 h-7 text-white" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2 text-gray-900 group-hover:text-cyan-700 transition-colors">{feature.title}</h3>
                            <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
