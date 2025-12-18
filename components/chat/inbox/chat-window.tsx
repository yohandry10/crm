"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { Conversation, Message } from "@/types/chat"
import { MoreVertical, Paperclip, Phone, Send, Users } from "lucide-react"
import { useMemo } from "react"

type Props = {
  selectedId: string | null
  selectedConversation?: Conversation
  messages: Message[]
  scrollRef: React.RefObject<HTMLDivElement | null>
  inputText: string
  onInputTextChange: (value: string) => void
  onSendMessage: () => void
  onKeyPress: (e: React.KeyboardEvent) => void
  sending: boolean
}

export function ChatWindow({
  selectedId,
  selectedConversation,
  messages,
  scrollRef,
  inputText,
  onInputTextChange,
  onSendMessage,
  onKeyPress,
  sending,
}: Props) {
  const title = useMemo(() => {
    return selectedConversation?.contact?.name || "Chat"
  }, [selectedConversation])

  if (!selectedId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <div className="bg-white p-6 rounded-full shadow-sm mb-4">
          <Users className="h-12 w-12 text-gray-300" />
        </div>
        <p>Selecciona una conversación para comenzar</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0">
      <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
            <AvatarFallback className="bg-cyan-100 text-cyan-700">
              {selectedConversation?.contact?.name?.substring(0, 2).toUpperCase() || "??"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                En línea (Bot activo)
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-gray-400">
          <Button variant="ghost" size="icon">
            <Phone className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center py-10 text-gray-400 text-sm">Este es el inicio de tu conversación.</div>
        )}

        {messages.map((msg) => {
          const isOutbound = msg.direction === "outbound"
          const isFile = (msg as any).metadata?.is_file

          return (
            <div
              key={msg.id}
              className={`flex gap-4 max-w-2xl ${isOutbound ? "ml-auto flex-row-reverse" : ""}`}
            >
              <Avatar className="h-8 w-8 mt-1">
                {isOutbound ? (
                  <AvatarFallback className="bg-gray-900 text-white text-xs">YO</AvatarFallback>
                ) : (
                  <AvatarFallback className="bg-cyan-100 text-cyan-700 text-xs">C</AvatarFallback>
                )}
              </Avatar>
              <div className="space-y-1">
                <div
                  className={`p-3 rounded-2xl shadow-sm text-sm ${
                    isOutbound
                      ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none"
                      : "bg-white border border-gray-100 text-gray-700 rounded-tl-none"
                  }`}
                >
                  {isFile ? (
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4" />
                      <span className="underline cursor-pointer">{msg.content}</span>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
                <div className={`flex gap-1 px-1 ${isOutbound ? "justify-end" : ""}`}>
                  <span className="text-[10px] text-gray-400">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 bg-white border-t border-gray-100 shrink-0">
        <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500 transition-all">
          <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-gray-600">
            <Paperclip className="h-5 w-5" />
          </Button>
          <textarea
            value={inputText}
            onChange={(e) => onInputTextChange(e.target.value)}
            onKeyDown={onKeyPress}
            placeholder="Escribe un mensaje... (Enter para enviar)"
            className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 min-h-[2.5rem] py-2.5 text-sm text-gray-900 placeholder:text-gray-400"
            rows={1}
            disabled={sending}
          />
          <Button
            onClick={onSendMessage}
            disabled={sending || !inputText.trim()}
            size="icon"
            className="h-10 w-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/20"
          >
            <Send className="h-5 w-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  )
}
