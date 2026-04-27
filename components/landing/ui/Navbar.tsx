"use client"

import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, ArrowRight } from "lucide-react"
import { MagneticButton } from "./MagneticButton"

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const navLinks = [
    { name: "Soluciones", href: "#soluciones" },
    { name: "Características", href: "#caracteristicas" },
    { name: "Precios", href: "#precios" },
  ]

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{
        y: scrolled ? -200 : 0,
        opacity: scrolled ? 0 : 1
      }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="fixed top-0 left-0 right-0 z-50 py-6"
    >
      <div
        className={`absolute inset-0 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-xl shadow-md" : "bg-transparent"
          }`}
      />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center">

          {/* Logo Section - INTACTO */}
          {/* Logo Section - Increased Size */}
          <Link href="/" className="flex items-center gap-2 group mr-auto shrink-0">
            <div
              className="relative h-32 w-48 md:h-44 md:w-80 transition-transform duration-300 hover:scale-105"
            >
              <Image
                src="/logo-black.png"
                alt="Neon System Logo"
                fill
                className="object-contain object-left"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation - SOLO AJUSTES DE ESPACIADO/ORDEN VISUAL */}
          {/* Desktop Navigation - Absolute Center */}
          <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="text-base font-medium text-gray-600 hover:text-gray-900 transition-colors relative group"
              >
                {item.name}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gray-800 transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 ml-auto">
            <Link
              href="/login"
              className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              Iniciar Sesión
            </Link>
            <MagneticButton
              href="/signup"
              className="relative group px-6 py-2.5 rounded-full text-sm font-medium overflow-hidden hidden sm:block"
            >
              <span className="absolute inset-0 bg-black" />
              <span className="relative text-white flex items-center gap-2">
                Empezar Gratis
                <ArrowRight className="w-4 h-4" />
              </span>
            </MagneticButton>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 text-gray-600"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu - INTACTO */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-t mt-3 shadow-lg"
          >
            <div className="px-6 py-4 space-y-4">
              {navLinks.map((item) => (
                <a
                  key={item.name}
                  href={item.href}
                  className="block text-base font-medium text-gray-600 hover:text-gray-900 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.name}
                </a>
              ))}
              <div className="pt-4 border-t border-gray-100 flex flex-col gap-3">
                <Link href="/login" className="block text-center text-gray-600 font-medium py-2">
                  Iniciar Sesión
                </Link>
                <Link
                  href="/signup"
                  className="block w-full text-center bg-black text-white rounded-full py-3 font-medium shadow-lg shadow-gray-900/25"
                >
                  Empezar Gratis
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
