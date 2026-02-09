"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "framer-motion"
import { useLoading } from "@/components/providers/loading-provider"

export function GlobalLoader() {
  const { isLoading } = useLoading()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="global-loader"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="fixed inset-0 z-[100] bg-white flex items-center justify-center"
          aria-live="polite"
          aria-busy="true"
          role="status"
        >
          <div className="relative flex flex-col items-center justify-center">
            {/* Soft ambient glow background */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6 }}
              className="absolute -z-10 w-[280px] h-[280px] rounded-full"
              style={{
                background:
                  "radial-gradient(circle at center, rgba(56,189,248,0.18), rgba(37,99,235,0.10), transparent 65%)",
                filter: "blur(10px)",
              }}
            />

            {/* Orbital system container */}
            <div className="relative w-40 h-40 flex items-center justify-center">
              {/* Outer orbit ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  border: "2px solid rgba(59,130,246,0.12)",
                  boxShadow: "0 0 0 1px rgba(56,189,248,0.08) inset",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              />

              {/* Inner orbit ring (counter-rotation) */}
              <motion.div
                className="absolute inset-[12px] rounded-full"
                style={{
                  border: "2px solid rgba(34,211,238,0.14)",
                }}
                animate={{ rotate: -360 }}
                transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
              />

              {/* Orbiting dot 1 */}
              <motion.div
                className="absolute w-2.5 h-2.5 rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(34,211,238,1), rgba(59,130,246,1))",
                  boxShadow:
                    "0 0 12px rgba(34,211,238,0.55), 0 0 24px rgba(59,130,246,0.35)",
                }}
                animate={{
                  rotate: 360,
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
              >
                {/* Position dot on orbit edge using transform trick */}
                <div className="w-full h-full translate-x-[76px]" />
              </motion.div>

              {/* Orbiting dot 2 */}
              <motion.div
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(59,130,246,1), rgba(14,165,233,1))",
                  boxShadow:
                    "0 0 10px rgba(59,130,246,0.5), 0 0 18px rgba(14,165,233,0.35)",
                }}
                animate={{
                  rotate: -360,
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-full h-full translate-x-[58px]" />
              </motion.div>

              {/* Logo with premium breathe + glow */}
              <motion.div
                className="relative w-24 h-24 rounded-2xl flex items-center justify-center"
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{
                  scale: [1, 1.03, 1],
                  opacity: 1,
                }}
                transition={{
                  duration: 1.2,
                  ease: "easeInOut",
                  times: [0, 0.5, 1],
                }}
              >
                {/* Subtle glass-like halo behind logo */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(56,189,248,0.08), rgba(37,99,235,0.08))",
                    boxShadow:
                      "0 10px 30px rgba(2,6,23,0.06), 0 0 0 1px rgba(59,130,246,0.06) inset",
                    backdropFilter: "blur(4px)",
                  }}
                  animate={{
                    opacity: [0.6, 0.9, 0.6],
                  }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <Image
                  src="/logo-white.png"
                  alt="NEON SYSTEM"
                  fill
                  className="object-contain p-2"
                  sizes="96px"
                  priority
                />
              </motion.div>
            </div>

            {/* Brand text (optional but looks premium) */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="mt-6 text-center"
            >
              <p className="text-[11px] tracking-[0.28em] text-slate-400">
                NEON SYSTEM
              </p>
              <p className="text-[10px] text-slate-400/80 mt-1">
                Initializing secure modules...
              </p>
            </motion.div>

            {/* Shimmer progress line */}
            <div className="relative mt-5 w-44 h-[4px] overflow-hidden rounded-full bg-slate-100">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgba(34,211,238,0.0), rgba(34,211,238,0.9), rgba(59,130,246,0.9), rgba(59,130,246,0.0))",
                }}
                initial={{ x: "-60%" }}
                animate={{ x: "60%" }}
                transition={{
                  duration: 1.1,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
