"use client"

import dynamic from "next/dynamic"
import { motion } from "framer-motion"
import { ArrowRight, Play } from "lucide-react"
import Link from "next/link"
import { MagneticButton } from "../ui/MagneticButton"
import { useEffect, useRef, useState } from "react"

const QuantumScene = dynamic(() => import("./QuantumScene"), { ssr: false })

function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
    const [count, setCount] = useState(0)
    const ref = useRef(null)

    useEffect(() => {
        let current = 0
        const increment = value / 60
        const timer = setInterval(() => {
            current += increment
            if (current >= value) {
                setCount(value)
                clearInterval(timer)
            } else {
                setCount(Math.floor(current))
            }
        }, 33)
        return () => clearInterval(timer)
    }, [value])

    return <span ref={ref}>{count}{suffix}</span>
}

export function Hero() {
    return (
        <section className="relative min-h-screen flex items-center justify-center pt-20 lg:pt-24 overflow-hidden">
            {/* Background with Gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-gray-50 via-white to-white z-0" />

            {/* Quantum 3D Scene - Rendered BEHIND content but above background */}
            <div className="absolute inset-y-0 right-0 w-full md:w-1/2 z-0 opacity-80 md:opacity-100 pointer-events-none">
                <QuantumScene />
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10 xl:gap-12 items-center">
                {/* Text Content */}
                <div className="text-center lg:text-left">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-50 border border-gray-200 mb-6 xl:mb-8"
                    >
                        <span className="w-2 h-2 rounded-full bg-gray-800 animate-pulse" />
                        <span className="text-xs sm:text-sm text-gray-700 font-medium text-center">Tecnología de Alto Rendimiento</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.08] mb-5 xl:mb-6 text-gray-900"
                    >
                        El futuro de la <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-700 to-gray-900">gestión empresarial</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.5 }}
                        className="text-base sm:text-lg xl:text-xl text-gray-500 max-w-2xl mx-auto lg:mx-0 mb-8 xl:mb-10 leading-relaxed"
                    >
                        CRM, analytics y automatización unificados en una plataforma diseñada para empresas que buscan escalar sin límites.
                    </motion.p>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.6 }}
                        className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10 xl:mb-16"
                    >
                        <MagneticButton
                            href="/signup"
                            className="group relative inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-semibold overflow-hidden shadow-lg shadow-gray-900/25"
                        >
                            <div className="absolute inset-0 bg-black" />
                            <span className="relative text-white flex items-center gap-2">Comenzar Gratis<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></span>
                        </MagneticButton>
                        <Link
                            href="/login"
                            className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-base font-medium text-gray-700 hover:text-gray-900 border border-gray-200 hover:border-gray-300 transition-all bg-white/50 backdrop-blur-sm"
                        >
                            <Play className="w-4 h-4" />Ver Demo
                        </Link>
                    </motion.div>

                    {/* Stats */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.8, delay: 0.8 }}
                        className="flex flex-wrap items-center justify-center lg:justify-start gap-10 sm:gap-14 xl:gap-16 border-t border-gray-100 pt-6 xl:pt-8"
                    >
                        {[
                            { value: 10, suffix: "K+", label: "Usuarios" },
                            { value: 99, suffix: ".9%", label: "Uptime" },
                            { value: 50, suffix: "+", label: "Integraciones" }
                        ].map((stat, i) => (
                            <div key={i} className="text-center lg:text-left">
                                <div className="text-2xl sm:text-3xl font-bold text-gray-900">
                                    <Counter value={stat.value} suffix={stat.suffix} />
                                </div>
                                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Empty div to balance grid for 3D content */}
                <div className="hidden lg:block h-full min-h-[600px]"></div>
            </div>
        </section>
    )
}
