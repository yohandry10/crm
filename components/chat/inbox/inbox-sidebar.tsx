"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Conversation } from "@/types/chat"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import { RefreshCw, Search } from "lucide-react"

type Props = {
  conversations: Conversation[]
  selectedId: string | null
  onSelect: (id: string) => void
  loading: boolean
  onRefresh: () => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
  newChatAction?: React.ReactNode
}

export function InboxSidebar({
  conversations,
  selectedId,
  onSelect,
  loading,
  onRefresh,
  searchTerm,
  onSearchTermChange,
  newChatAction,
}: Props) {
  const emptyText = useMemo(() => {
    if (searchTerm) return "No se encontraron resultados."
    return "No hay conversaciones activas."
  }, [searchTerm])

  return (
    <div className="w-96 border-r border-gray-100 flex flex-col bg-gray-50/50">
      <div className="p-4 border-b border-gray-100 bg-white space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Buzón</h1>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRefresh}>
              <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? "animate-spin" : ""}`} />
            </Button>
            {newChatAction}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar en todos los chats..."
            className="pl-8 bg-gray-50 border-0"
            value={searchTerm}
            onChange={(e) => onSearchTermChange(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 && !loading && (
          <div className="p-8 text-center text-gray-400 text-sm">{emptyText}</div>
        )}

        {loading && conversations.length === 0 && (
          <div className="p-8 text-center text-gray-400 text-sm">Cargando conversaciones...</div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className={`p-4 border-b border-gray-100 hover:bg-white cursor-pointer transition-colors ${
              selectedId === conv.id ? "bg-white border-l-4 border-l-cyan-500 shadow-sm" : ""
            }`}
          >
            <div className="flex justify-between items-start mb-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 truncate max-w-[140px]">
                  {conv.contact?.name || conv.subject || "Desconocido"}
                </span>
                {conv.channel?.type === "whatsapp" && (
                  <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 h-5 px-1">
                    WA
                  </Badge>
                )}
                {conv.channel?.type === "email" && (
                  <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 h-5 px-1">
                    Mail
                  </Badge>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">
                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: es }).replace(
                  "alrededor de ",
                  ""
                )}
              </span>
            </div>
            <p className="text-sm text-gray-600 line-clamp-1">{conv.last_message?.content || "Sin mensajes"}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

