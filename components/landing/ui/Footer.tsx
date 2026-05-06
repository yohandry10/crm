"use client"

import Link from "next/link"
import Image from "next/image"

export function Footer() {
    return (
        <footer className="bg-black border-t border-gray-800 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8 mb-2">

                    {/* Col 1: Logo (Left Corner - MASSIVE) */}
                    <div className="flex flex-col gap-0">
                        <Link href="/" className="relative h-32 w-64 md:h-40 md:w-96 transition-opacity hover:opacity-80 -ml-4 -mt-10">
                            <Image
                                src="/logo-black.png"
                                alt="Neon System Logo"
                                fill
                                className="object-contain object-left"
                            />
                        </Link>
                        <p className="text-white text-sm leading-relaxed max-w-sm -mt-6">
                            Plataforma integral de gestión empresarial.
                        </p>
                    </div>

                    {/* Col 2: Product */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-white">Producto</h3>
                        <Link href="/#caracteristicas" className="text-white hover:text-gray-300 text-sm transition-colors">CRM Inteligente</Link>
                        <Link href="/#caracteristicas" className="text-white hover:text-gray-300 text-sm transition-colors">Automatización</Link>
                        <Link href="/#precios" className="text-white hover:text-gray-300 text-sm transition-colors">Analytics</Link>
                    </div>

                    {/* Col 3: Company */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-white">Compañía</h3>
                        <Link href="/#caracteristicas" className="text-white hover:text-gray-300 text-sm transition-colors">Sobre Nosotros</Link>
                        <Link href="/#precios" className="text-white hover:text-gray-300 text-sm transition-colors">Planes</Link>
                        <Link href="mailto:contacto@neonsystem.pe" className="text-white hover:text-gray-300 text-sm transition-colors">Contacto</Link>
                    </div>

                    {/* Col 4: Legal */}
                    <div className="flex flex-col gap-4">
                        <h3 className="font-semibold text-white">Legal</h3>
                        <Link href="/terms" className="text-white hover:text-gray-300 text-sm transition-colors">Términos</Link>
                        <Link href="/privacy" className="text-white hover:text-gray-300 text-sm transition-colors">Privacidad</Link>
                        <Link href="/privacy" className="text-white hover:text-gray-300 text-sm transition-colors">Seguridad</Link>
                    </div>

                    {/* Col 5: CTA */}
                    <div className="flex flex-col gap-4">
                        <p className="text-sm font-semibold text-white">Acceso</p>
                        <Link href="/signup" className="rounded-lg bg-white px-4 py-2 text-center text-sm font-medium text-black transition-colors hover:bg-gray-200">
                            Crear cuenta
                        </Link>
                        <Link href="/login" className="text-white hover:text-gray-300 text-sm transition-colors">
                            Iniciar sesión
                        </Link>
                    </div>

                </div>

                {/* Bottom Section: Copyright */}
                <div className="pt-2 border-t border-gray-800 text-center">
                    <p className="text-sm text-white">© 2026 NEON SYSTEM. Todos los derechos reservados.</p>
                </div>
            </div>
        </footer>
    )
}
