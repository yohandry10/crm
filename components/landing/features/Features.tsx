"use client"

import { motion } from "framer-motion"
import { Users, BarChart3, Zap, ArrowRight } from "lucide-react"

export function Features() {
    return (
        <section id="caracteristicas" className="bg-black py-24 sm:py-32 relative overflow-hidden">
            {/* Subtle Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-white/5 rounded-[100%] blur-[120px] pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 relative z-10">
                {/* Header */}
                <div className="max-w-3xl mb-20 text-center mx-auto">
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white mb-6"
                    >
                        Poder y Control <br />
                        <span className="text-gray-500">sin complicaciones</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-xl text-gray-400 leading-relaxed max-w-2xl mx-auto"
                    >
                        Arquitectura empresarial de próxima generación diseñada para eliminar el caos y escalar tu operación.
                    </motion.p>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-6 grid-rows-[auto_auto_auto] md:grid-rows-[350px_350px]">

                    {/* CARD 1: CRM (Large - Top Left - 4 cols) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        className="md:col-span-4 bg-zinc-900/50 rounded-3xl border border-white/10 p-8 overflow-hidden relative group hover:border-white/20 transition-all duration-500"
                    >
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">CRM Unificado</h3>
                            <p className="text-gray-400 max-w-[220px]">Vista 360° de tus clientes. Pipeline de ventas visual, historial de interacciones y scoring predictivo.</p>
                        </div>

                        {/* UI Mockup - CRM List */}
                        <div className="absolute right-0 top-12 w-3/5 h-full opacity-50 group-hover:opacity-100 group-hover:-translate-x-2 transition-all duration-500">
                            <div className="bg-[#0A0A0A] rounded-tl-2xl border-l border-t border-white/10 p-6 h-full shadow-2xl">
                                <div className="space-y-4">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-900/50 border border-white/5">
                                            <div className="w-8 h-8 rounded-full bg-zinc-800" />
                                            <div className="flex-1 space-y-2">
                                                <div className="h-2 w-24 bg-zinc-700 rounded full" />
                                                <div className="h-1.5 w-16 bg-zinc-800 rounded full" />
                                            </div>
                                            <div className="h-6 w-16 bg-white/5 rounded-full" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* CARD 2: Analytics (Standard - Top Right - 2 cols) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="md:col-span-2 bg-white rounded-3xl border border-white/10 p-8 overflow-hidden relative group"
                    >
                        <div className="relative z-10 h-full flex flex-col justify-between">
                            <div>
                                <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center mb-6">
                                    <BarChart3 className="w-6 h-6 text-black" />
                                </div>
                                <h3 className="text-2xl font-bold text-black mb-2">Analytics</h3>
                                <p className="text-gray-500 text-sm">Métricas que importan, en tiempo real.</p>
                            </div>

                            {/* UI Mockup - Chart */}
                            <div className="flex items-end justify-between gap-2 h-24 mt-4">
                                {[40, 70, 45, 90, 65].map((h, i) => (
                                    <div key={i} className="w-full bg-black rounded-t-sm transition-all duration-700 group-hover:bg-zinc-800" style={{ height: `${h}%` }} />
                                ))}
                            </div>
                        </div>
                    </motion.div>

                    {/* CARD 3: Automation (Standard - Bottom Left - 2 cols) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="md:col-span-2 bg-zinc-900/50 rounded-3xl border border-white/10 p-8 overflow-hidden relative group hover:bg-zinc-900 transition-colors"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80" />
                        <div className="relative z-10">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-6">
                                <Zap className="w-6 h-6 text-white" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-2">Automatización</h3>
                            <p className="text-gray-400 text-sm mb-6">Workflows que trabajan mientras duermes.</p>

                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 p-3 text-xs text-gray-300 font-mono bg-black rounded-lg border border-white/10">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    New Lead Created
                                </div>
                                <div className="w-0.5 h-4 bg-zinc-700 ml-4" />
                                <div className="flex items-center gap-3 p-3 text-xs text-gray-300 font-mono bg-black rounded-lg border border-white/10">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    Send Email Sequence
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* CARD 4: AI & More (Large - Bottom Right - 4 cols) */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.3 }}
                        className="md:col-span-4 bg-black rounded-3xl border border-white/10 p-8 md:p-12 overflow-hidden relative group"
                    >
                        {/* Gradient Grid */}
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]" />

                        <div className="relative z-10 flex flex-col md:flex-row items-center gap-12">
                            <div className="flex-1 space-y-6">
                                <h3 className="text-3xl font-bold text-white">IA Nativa</h3>
                                <p className="text-gray-400 text-lg">
                                    No es un "plugin". Nuestro motor de Inteligencia Artificial vive en el núcleo del sistema, optimizando cada decisión.
                                </p>
                                <ul className="space-y-3">
                                    {['Predicción de Churn', 'Generación de Contratos', 'Lead Scoring Automático'].map((item) => (
                                        <li key={item} className="flex items-center gap-3 text-gray-300">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <button className="text-white font-medium flex items-center gap-2 group-hover:gap-4 transition-all mt-4">
                                    Explorar AI <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Visual Element */}
                            <div className="w-full md:w-1/2 relative aspect-video bg-zinc-900 rounded-lg border border-white/10 p-4 shadow-2xl transform rotate-3 group-hover:rotate-0 transition-all duration-700">
                                <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-3">
                                    <div className="w-2 h-2 rounded-full bg-red-500" />
                                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                </div>
                                <div className="space-y-3">
                                    <div className="h-8 bg-white/5 rounded w-3/4 animate-pulse" />
                                    <div className="h-4 bg-white/5 rounded w-1/2" />
                                    <div className="h-4 bg-white/5 rounded w-full" />
                                    <div className="h-4 bg-white/5 rounded w-5/6" />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    )
}
