"use client"

import Link from "next/link"
import Image from "next/image"
import { Facebook, Twitter, Instagram, Linkedin, Send } from "lucide-react"

export function Footer() {
    return (
        <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-2">

                    {/* Col 1: Logo (Left Corner - MASSIVE) */}
                    <div className="flex flex-col gap-0">
                        <Link href="/" className="relative h-32 w-64 md:h-40 md:w-96 transition-opacity hover:opacity-80 -ml-4 -mt-10">
                            <Image
                                src="/logo.png"
                                alt="Neon System Logo"
                                fill
                                className="object-contain object-left"
                            />
                        </Link>
                        <p className="text-gray-500 text-sm leading-relaxed max-w-sm -mt-6">
                            Plataforma integral de gestión empresarial.
                        </p>
                    </div>

                    {/* Col 2: Product */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-gray-900">Producto</h3>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">CRM Inteligente</Link>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Automatización</Link>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Analytics</Link>
                    </div>

                    {/* Col 3: Company */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-gray-900">Compañía</h3>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Sobre Nosotros</Link>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Blog</Link>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Contacto</Link>
                    </div>

                    {/* Col 4: Legal */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-gray-900">Legal</h3>
                        <Link href="/terms" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Términos</Link>
                        <Link href="/privacy" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Privacidad</Link>
                        <Link href="#" className="text-gray-500 hover:text-cyan-600 text-sm transition-colors">Seguridad</Link>
                    </div>

                    {/* Col 5: Newsletter & Socials */}
                    <div className="flex flex-col gap-4">
                        <p className="text-sm font-semibold text-gray-900">Novedades</p>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="email"
                                placeholder="Email"
                                className="bg-gray-50 border border-gray-200 text-sm rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                            />
                            <button className="bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg p-2 transition-colors">
                                <Send className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Social Icons (Moved here as requested) */}
                        <div className="flex items-center gap-4 mt-2">
                            <a href="#" className="text-gray-400 hover:text-cyan-600 transition-colors"><Twitter className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-cyan-600 transition-colors"><Linkedin className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-cyan-600 transition-colors"><Instagram className="w-5 h-5" /></a>
                            <a href="#" className="text-gray-400 hover:text-cyan-600 transition-colors"><Facebook className="w-5 h-5" /></a>
                        </div>
                    </div>

                </div>

                {/* Bottom Section: Copyright */}
                <div className="pt-2 border-t border-gray-100 text-center">
                    <p className="text-sm text-gray-400">© 2025 NEON SYSTEM. Todos los derechos reservados.</p>
                </div>
            </div>
        </footer>
    )
}
