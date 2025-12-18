"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Conversation } from "@/types/chat"
import Link from "next/link"
import { toast } from "sonner"

type Props = {
  selectedConversation: Conversation
  selectedId: string | null
  onSendBrochure: () => void
  onRefreshConversations: () => void
}

export function ContactSidebar({ selectedConversation, selectedId, onSendBrochure, onRefreshConversations }: Props) {
  return (
    <div className="w-80 border-l border-gray-100 bg-white hidden xl:flex flex-col shrink-0">
      <div className="p-6 text-center border-b border-gray-100">
        <Avatar className="h-20 w-20 mx-auto mb-4 border-4 border-gray-50">
          <AvatarFallback className="bg-cyan-100 text-cyan-700 text-2xl">
            {selectedConversation?.contact?.name?.substring(0, 2).toUpperCase() || "??"}
          </AvatarFallback>
        </Avatar>
        <h3 className="font-bold text-lg text-gray-900">{selectedConversation?.contact?.name || "Sin Nombre"}</h3>
        <p className="text-sm text-gray-500">{selectedConversation?.contact?.email || "Sin email"}</p>
      </div>

      <div className="p-4 space-y-4">
        {selectedConversation?.metadata?.tags && Array.isArray((selectedConversation as any).metadata.tags) && (
          <div className="flex flex-wrap gap-2">
            {(selectedConversation as any).metadata.tags.map((tag: string) => (
              <Badge
                key={tag}
                variant={tag === "Riesgo" ? "destructive" : "default"}
                className={tag === "Riesgo" ? "bg-red-500" : "bg-green-600"}
              >
                {tag === "Riesgo" ? "⚠️ Riesgo Detectado" : "💰 Oportunidad"}
              </Badge>
            ))}
          </div>
        )}

        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
          <h4 className="flex items-center gap-2 font-bold text-indigo-900 text-xs mb-2">
            <span className="text-indigo-500">✨</span> AI Copilot
          </h4>
          <p className="text-xs text-indigo-700 mb-2 leading-relaxed">
            {(selectedConversation as any)?.metadata?.last_sentiment === "negative"
              ? "Atención: El cliente parece molesto. Se recomienda empatía."
              : (selectedConversation as any)?.metadata?.last_sentiment === "positive"
                ? "Positivo: El cliente muestra intención de compra."
                : "La IA está monitoreando esta conversación."}
          </p>

          {(selectedConversation as any)?.metadata?.suggested_action === "create_opportunity" && (
            <Button
              size="sm"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8 mb-2 shadow-sm animate-in fade-in zoom-in duration-300"
              onClick={async () => {
                if (!selectedConversation.contact_id) {
                  toast.error("Este chat no tiene un contacto asignado")
                  return
                }
                const toastId = toast.loading("Creando oportunidad...")
                try {
                  const res = await fetch("/api/opportunities", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: `Oportunidad Web: ${selectedConversation.contact?.name}`,
                      contact_id: selectedConversation.contact_id,
                      expected_revenue: 500,
                      stage_id: "prospecting",
                      probability: 20,
                    }),
                  })
                  const data = await res.json()
                  if (data.success) {
                    toast.success("Oportunidad creada exitosamente", { id: toastId })
                  } else {
                    toast.error(data.error || "Error al crear", { id: toastId })
                  }
                } catch {
                  toast.error("Error de conexión", { id: toastId })
                }
              }}
            >
              💰 Crear Oportunidad (S/ 500)
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="w-full bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50 text-xs h-8"
            onClick={onSendBrochure}
          >
            Enviar Brochure PDF
          </Button>
        </div>

        <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
          <p className="text-[10px] text-gray-400 mb-2 font-mono uppercase">Simulador de Cliente</p>
          <div className="flex gap-2">
            <Input
              className="h-7 text-xs bg-white"
              placeholder="Simular respuesta..."
              onKeyDown={async (e) => {
                if (e.key !== "Enter") return
                if (!selectedId) return
                const val = (e.currentTarget as HTMLInputElement).value
                ;(e.currentTarget as HTMLInputElement).value = ""
                try {
                  await fetch("/api/chat/simulate", {
                    method: "POST",
                    body: JSON.stringify({ conversation_id: selectedId, content: val }),
                  })
                  toast.success("Mensaje simulado")
                  onRefreshConversations()
                } catch {
                  toast.error("Error simulando")
                }
              }}
            />
          </div>
          <div className="flex gap-1 mt-2">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] w-full"
              onClick={async () => {
                if (!selectedId) return
                await fetch("/api/chat/simulate", {
                  method: "POST",
                  body: JSON.stringify({
                    conversation_id: selectedId,
                    content: "Esto es una estafa, estoy muy molesto con el servicio!",
                  }),
                })
                onRefreshConversations()
              }}
            >
              😡 Enojo
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] w-full"
              onClick={async () => {
                if (!selectedId) return
                await fetch("/api/chat/simulate", {
                  method: "POST",
                  body: JSON.stringify({
                    conversation_id: selectedId,
                    content: "Me interesa mucho el precio del plan pro, quiero comprar.",
                  }),
                })
                onRefreshConversations()
              }}
            >
              💰 Compra
            </Button>
          </div>
        </div>

        <Link href={`/contacts/${selectedConversation?.contact_id || ""}`} className="w-full block">
          <Button className="w-full border-gray-200 text-gray-600" variant="outline">
            Ver Perfil Completo
          </Button>
        </Link>
      </div>
    </div>
  )
}

