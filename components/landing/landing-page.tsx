"use client"

import dynamic from "next/dynamic"
import { useState, useEffect } from "react"
import { AnimatePresence } from "framer-motion"

const QuantumPreloader = dynamic(
  () => import("./preloader/Preloader").then((m) => m.QuantumPreloader),
  { ssr: false }
)
import { Navbar } from "./ui/Navbar"
import { Hero } from "./hero/Hero"
import { Features } from "./features/Features"
import { CallToAction } from "./ui/CallToAction"
import { Footer } from "./ui/Footer"

export default function LandingPage() {
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (loading) {
      document.body.style.overflow = 'hidden'
      window.scrollTo(0, 0)
    } else {
      document.body.style.overflow = ''
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    return () => { document.body.style.overflow = '' }
  }, [loading])

  return (
    <>
      <AnimatePresence mode="wait">
        {loading && <QuantumPreloader onComplete={() => setLoading(false)} />}
      </AnimatePresence>

      <div className={`min-h-screen bg-white text-gray-900 ${loading ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}`}>
        <Navbar />
        <Hero />
        <Features />
        <CallToAction />
        <Footer />
      </div>
    </>
  )
}
