import Image from "next/image"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { MagneticButton } from "./MagneticButton"

export function CallToAction() {
    return (
        <section className="py-24 relative overflow-hidden">
            {/* Background Image with Overlay */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/cta-bg.png"
                    alt="Abstract Tech Background"
                    fill
                    className="object-cover object-center"
                    priority
                />
                <div className="absolute inset-0 bg-black/80" />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="max-w-4xl mx-auto px-6 text-center relative z-10"
            >
                <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">¿Listo para empezar?</h2>
                <p className="text-xl text-gray-300 mb-10">Únete a miles de empresas que ya transformaron su gestión.</p>
                <MagneticButton
                    href="/signup"
                    className="group relative inline-flex items-center gap-3 px-10 py-5 rounded-full text-lg font-semibold overflow-hidden shadow-xl shadow-cyan-500/10 hover:shadow-cyan-500/20 transition-all"
                >
                    <span className="absolute inset-0 bg-white" />
                    <span className="relative text-black flex items-center gap-2">
                        Crear Cuenta Gratis
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                </MagneticButton>
                <p className="text-sm text-gray-400 mt-6">Sin tarjeta • Setup en 2 min</p>
            </motion.div>
        </section>
    )
}
