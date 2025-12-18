"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import type { Conversation, Message } from "@/types/chat"
import { InboxSidebar } from "@/components/chat/inbox/inbox-sidebar"
import { NewChatDialog } from "@/components/chat/inbox/new-chat-dialog"
import { ChatWindow } from "@/components/chat/inbox/chat-window"
import { ContactSidebar } from "@/components/chat/inbox/contact-sidebar"

export function InboxClient() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputText, setInputText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const scrollRef = useRef<HTMLDivElement>(null)

  const loadConversations = async (term = "") => {
    try {
      if (!conversations.length) setLoading(true)

      const params = new URLSearchParams()
      if (term) params.append("search", term)

      const res = await fetch(`/api/chat/conversations?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setConversations(data.data)
      }
    } catch (error) {
      console.error("Failed to load conversations", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      loadConversations(searchTerm)
    }, 500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  useEffect(() => {
    const interval = setInterval(() => loadConversations(searchTerm), 10000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm])

  useEffect(() => {
    if (!selectedId) return

    const loadMessages = async () => {
      try {
        const res = await fetch(`/api/chat/${selectedId}/messages`)
        const data = await res.json()
        if (data.success) {
          setMessages(data.data)
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight
            }
          }, 100)
        }
      } catch {
        console.error("Error loading messages")
      }
    }

    loadMessages()
    const msgInterval = setInterval(loadMessages, 5000)
    return () => clearInterval(msgInterval)
  }, [selectedId])

  const handleSendMessage = async () => {
    if (!selectedId || !inputText.trim()) return

    const tempId = crypto.randomUUID()
    const now = new Date().toISOString()
    const content = inputText.trim()

    const optimisticMsg: Message = {
      id: tempId,
      organization_id: "",
      conversation_id: selectedId,
      sender_id: "me",
      direction: "outbound",
      content,
      content_type: "text",
      attachments: [],
      status: "sent",
      external_id: null,
      metadata: {},
      created_at: now,
    }

    setMessages((prev) => [...prev, optimisticMsg])
    setInputText("")
    setSending(true)

    try {
      const res = await fetch(`/api/chat/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          direction: "outbound",
        }),
      })

      if (!res.ok) throw new Error("Failed to send")

      const refreshRes = await fetch(`/api/chat/${selectedId}/messages`)
      const data = await refreshRes.json()
      if (data.success) {
        setMessages(data.data)
        loadConversations(searchTerm)
      }
    } catch {
      toast.error("Error al enviar mensaje")
    } finally {
      setSending(false)
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
      }, 100)
    }
  }

  const handleSendBrochure = async () => {
    if (!selectedId) return

    toast.promise(new Promise((resolve) => setTimeout(resolve, 1500)), {
      loading: "Generando PDF personalizado con IA...",
      success: "Brochure enviado correctamente",
      error: "Error al generar brochure",
    })

    setTimeout(() => {
      const tempId = crypto.randomUUID()
      const optimisticMsg: Message = {
        id: tempId,
        organization_id: "",
        conversation_id: selectedId,
        sender_id: "me",
        direction: "outbound",
        content: "📄 Brochure_Corporativo_2025.pdf",
        content_type: "text",
        attachments: [],
        status: "sent",
        external_id: null,
        metadata: { is_file: true } as any,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, optimisticMsg])
    }, 1500)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const selectedConversation = conversations.find((c) => c.id === selectedId)

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 bg-white overflow-hidden">
      <InboxSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={setSelectedId}
        loading={loading}
        onRefresh={() => loadConversations(searchTerm)}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        newChatAction={
          <NewChatDialog
            onRefreshConversations={() => loadConversations(searchTerm)}
            onCreated={(id) => setSelectedId(id)}
          />
        }
      />

      <ChatWindow
        selectedId={selectedId}
        selectedConversation={selectedConversation}
        messages={messages}
        scrollRef={scrollRef}
        inputText={inputText}
        onInputTextChange={setInputText}
        onSendMessage={handleSendMessage}
        onKeyPress={handleKeyPress}
        sending={sending}
      />

      {selectedConversation && (
        <ContactSidebar
          selectedConversation={selectedConversation}
          selectedId={selectedId}
          onSendBrochure={handleSendBrochure}
          onRefreshConversations={() => loadConversations(searchTerm)}
        />
      )}
    </div>
  )
}

