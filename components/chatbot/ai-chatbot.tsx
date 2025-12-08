"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageCircle, Send, Bot, User, Loader2, X, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  content: string
  isAi: boolean
  timestamp: Date
}

export function AIChatbot() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "¡Hola! Soy tu asistente NEON con IA. ¿En qué puedo ayudarte?",
      isAi: true,
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      isAi: false,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
      })
      const data = await response.json()

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: data.response || "Lo siento, no pude procesar tu consulta.",
        isAi: true,
        timestamp: new Date(),
      }])
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: "Error al procesar tu consulta. Intenta nuevamente.",
        isAi: true,
        timestamp: new Date(),
      }])
    } finally {
      setIsLoading(false)
    }
  }


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Floating Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full",
          "bg-gradient-to-r from-cyan-500 to-blue-600",
          "flex items-center justify-center shadow-2xl shadow-cyan-500/25",
          "hover:shadow-cyan-500/40 transition-shadow duration-300",
          isOpen && "hidden"
        )}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <MessageCircle className="w-6 h-6 text-white" />
        <motion.span
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[#030303]"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.button>

      {/* Chat Modal */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[550px] rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
          >
            {/* Glass Background */}
            <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl" />
            
            {/* Gradient Orbs */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-cyan-500/10 rounded-full blur-[60px]" />
            <div className="absolute bottom-20 left-0 w-32 h-32 bg-blue-600/10 rounded-full blur-[50px]" />

            {/* Header */}
            <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-3">
                <motion.div 
                  className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Sparkles className="w-5 h-5 text-white" />
                </motion.div>
                <div>
                  <h3 className="font-semibold text-white text-sm">NEON Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs text-white/40">Online</span>
                  </div>
                </div>
              </div>
              <motion.button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X className="w-4 h-4 text-white/60" />
              </motion.button>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="relative h-[380px] overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            >
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    "flex gap-3",
                    !message.isAi && "flex-row-reverse"
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                    message.isAi 
                      ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20" 
                      : "bg-white/[0.08] border border-white/[0.08]"
                  )}>
                    {message.isAi ? (
                      <Bot className="w-4 h-4 text-cyan-400" />
                    ) : (
                      <User className="w-4 h-4 text-white/60" />
                    )}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn(
                    "max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    message.isAi 
                      ? "bg-white/[0.05] border border-white/[0.06] text-white/80 rounded-tl-md" 
                      : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-tr-md"
                  )}>
                    {message.content}
                  </div>
                </motion.div>
              ))}

              {/* Loading */}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-white/[0.05] border border-white/[0.06]">
                    <div className="flex gap-1.5">
                      {[0, 1, 2].map((i) => (
                        <motion.span
                          key={i}
                          className="w-2 h-2 rounded-full bg-cyan-400/60"
                          animate={{ y: [0, -6, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="relative px-4 py-4 border-t border-white/[0.06]">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-cyan-500/30 transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu mensaje..."
                  className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                <motion.button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                    input.trim() && !isLoading
                      ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white"
                      : "bg-white/[0.05] text-white/30"
                  )}
                  whileHover={input.trim() && !isLoading ? { scale: 1.05 } : {}}
                  whileTap={input.trim() && !isLoading ? { scale: 0.95 } : {}}
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              </div>
              <p className="text-[10px] text-white/20 text-center mt-2">
                Powered by NEON AI
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
