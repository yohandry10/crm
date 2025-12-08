"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Bot, User } from "lucide-react"

interface MCPClientProps {
  onResponse?: (response: any) => void
}

export function MCPClient({ onResponse }: MCPClientProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState<
    Array<{
      type: "user" | "ai"
      message: string
      timestamp: string
      data?: any
    }>
  >([])

  const handleQuery = async () => {
    if (!query.trim() || loading) return

    setLoading(true)
    const userMessage = {
      type: "user" as const,
      message: query,
      timestamp: new Date().toISOString(),
    }

    setConversation((prev) => [...prev, userMessage])

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: query,
          context: {},
        }),
      })

      const data = await response.json()

      const aiMessage = {
        type: "ai" as const,
        message: data.response,
        timestamp: data.timestamp,
        data: data.context,
      }

      setConversation((prev) => [...prev, aiMessage])
      onResponse?.(data)
    } catch (error) {
      const errorMessage = {
        type: "ai" as const,
        message: "Error procesando tu consulta. Intenta nuevamente.",
        timestamp: new Date().toISOString(),
      }
      setConversation((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
      setQuery("")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleQuery()
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-600" />
          Asistente IA con MCP
          <Badge variant="outline" className="ml-auto">
            Conectado
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Conversación */}
        <div className="h-96 overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg">
          {conversation.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 text-cyan-600" />
              <p>¡Hola! Soy tu asistente IA del CRM.</p>
              <p className="text-sm mt-2">Pregúntame sobre contactos, analytics, facturas o cualquier cosa del CRM.</p>
            </div>
          ) : (
            conversation.map((msg, index) => (
              <div key={index} className={`flex gap-3 ${msg.type === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex gap-2 max-w-[80%] ${msg.type === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.type === "user" ? "bg-primary text-primary-foreground" : "bg-cyan-600 text-white"
                    }`}
                  >
                    {msg.type === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`rounded-lg p-3 ${
                      msg.type === "user" ? "bg-primary text-primary-foreground" : "bg-background border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.message}</p>
                    <p className="text-xs opacity-70 mt-1">{new Date(msg.timestamp).toLocaleTimeString()}</p>
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="flex gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-background border rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Ej: 'Muéstrame contactos con score mayor a 70' o 'Genera una factura para Juan Pérez'"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleQuery} disabled={loading || !query.trim()} className="bg-cyan-600 hover:bg-cyan-700">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
          </Button>
        </div>

        {/* Sugerencias */}
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-muted-foreground">Prueba:</span>
          {["Contactos con score alto", "Analytics del mes", "Generar factura", "Predecir lead score"].map(
            (suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                onClick={() => setQuery(suggestion)}
                disabled={loading}
                className="text-xs"
              >
                {suggestion}
              </Button>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  )
}
