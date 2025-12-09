"use client"

import { useState, useEffect, useRef } from "react"
import { Users, Filter, Plus, Send, Phone, MoreVertical, Paperclip, Search, RefreshCw, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { type Conversation, type Message } from "@/types/chat"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function InboxClient() {
    const router = useRouter()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [inputText, setInputText] = useState("")
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    // New Chat State
    const [isNewChatOpen, setIsNewChatOpen] = useState(false)
    const [contacts, setContacts] = useState<any[]>([])
    const [selectedContactId, setSelectedContactId] = useState<string>("")
    const [selectedChannelType, setSelectedChannelType] = useState<string>("whatsapp")
    const [newChatSubject, setNewChatSubject] = useState("")
    const [creatingChat, setCreatingChat] = useState(false)

    const scrollRef = useRef<HTMLDivElement>(null)

    // 1. Load Conversations (with Search)
    const loadConversations = async (term = "") => {
        try {
            // Only show loading on initial load or manual refresh, not on search debounce to avoid flicker
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

    // Debounced Search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadConversations(searchTerm)
        }, 500)
        return () => clearTimeout(timer)
    }, [searchTerm])

    // Polling
    useEffect(() => {
        const interval = setInterval(() => loadConversations(searchTerm), 10000)
        return () => clearInterval(interval)
    }, [searchTerm])

    // Load Contacts for New Chat
    const loadContacts = async () => {
        try {
            const res = await fetch('/api/contacts?limit=50')
            const data = await res.json()
            if (data.success || Array.isArray(data)) {
                setContacts(data.data || data)
            }
        } catch (e) {
            console.error("Failed to load contacts", e)
        }
    }

    useEffect(() => {
        if (isNewChatOpen) {
            loadContacts()
        }
    }, [isNewChatOpen])

    // Create New Chat
    const handleCreateChat = async () => {
        if (!selectedContactId) return

        try {
            setCreatingChat(true)
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contact_id: selectedContactId,
                    channel_id: null, // Default channel or auto-select
                    subject: newChatSubject || "Nueva conversación"
                })
            })
            const data = await res.json()

            if (data.success) {
                toast.success("Conversación iniciada")
                setIsNewChatOpen(false)
                setSelectedContactId("")
                setNewChatSubject("")
                await loadConversations()
                setSelectedId(data.data.id)
            } else {
                const errorMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error)
                toast.error(errorMessage || "Error al crear chat")
            }
        } catch (error) {
            toast.error("Error de conexión")
        } finally {
            setCreatingChat(false)
        }
    }

    // 2. Load Messages
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
            } catch (error) {
                console.error("Error loading messages")
            }
        }

        loadMessages()
        const msgInterval = setInterval(loadMessages, 5000)
        return () => clearInterval(msgInterval)

    }, [selectedId])

    // 3. Send Message
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
            direction: 'outbound',
            content: content,
            content_type: 'text',
            attachments: [],
            status: 'sent',
            external_id: null,
            metadata: {},
            created_at: now
        }

        setMessages(prev => [...prev, optimisticMsg])
        setInputText("")
        setSending(true)

        try {
            const res = await fetch(`/api/chat/${selectedId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content,
                    direction: 'outbound'
                })
            })

            if (!res.ok) throw new Error("Failed to send")

            const refreshRes = await fetch(`/api/chat/${selectedId}/messages`)
            const data = await refreshRes.json()
            if (data.success) {
                setMessages(data.data)
                loadConversations(searchTerm) // Bring to top
            }

        } catch (error) {
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
        toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
            loading: 'Generando PDF personalizado con IA...',
            success: 'Brochure enviado correctamente',
            error: 'Error al generar brochure'
        })

        // Optimistically add the file message
        setTimeout(() => {
            const tempId = crypto.randomUUID()
            const optimisticMsg: Message = {
                id: tempId,
                organization_id: "",
                conversation_id: selectedId,
                sender_id: "me",
                direction: 'outbound',
                content: "📄 Brochure_Corporativo_2025.pdf",
                content_type: 'text', // Should be 'file' but using text for now to avoid rendering issues
                attachments: [],
                status: 'sent',
                external_id: null,
                metadata: { is_file: true },
                created_at: new Date().toISOString()
            }
            setMessages(prev => [...prev, optimisticMsg])
        }, 1500)
    }

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSendMessage()
        }
    }

    const selectedConversation = conversations.find(c => c.id === selectedId)

    return (
        <div className="flex h-[calc(100vh-6rem)] -m-6 bg-white overflow-hidden">

            {/* ---------------- LEFT SIDEBAR ---------------- */}
            <div className="w-96 border-r border-gray-100 flex flex-col bg-gray-50/50">
                <div className="p-4 border-b border-gray-100 bg-white space-y-4">
                    <div className="flex items-center justify-between">
                        <h1 className="text-xl font-bold text-gray-900">Buzón</h1>
                        <div className="flex items-center gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => loadConversations(searchTerm)}>
                                <RefreshCw className={`h-4 w-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                            </Button>

                            <Dialog open={isNewChatOpen} onOpenChange={setIsNewChatOpen}>
                                <DialogTrigger asChild>
                                    <Button size="icon" className="h-8 w-8 bg-cyan-600 hover:bg-cyan-700 text-white rounded-full">
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Nueva Conversación</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Cliente</label>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className="w-full justify-between">
                                                        {selectedContactId
                                                            ? contacts.find((contact) => contact.id === selectedContactId)?.name
                                                            : "Buscar contacto..."}
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-full p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Buscar cliente..." />
                                                        <CommandList>
                                                            <CommandEmpty>No se encontraron clientes.</CommandEmpty>
                                                            <CommandGroup>
                                                                {contacts.map((contact) => (
                                                                    <CommandItem
                                                                        key={contact.id}
                                                                        value={contact.name}
                                                                        onSelect={() => {
                                                                            setSelectedContactId(contact.id)
                                                                            // Close popup logic handled by component usually
                                                                        }}
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "mr-2 h-4 w-4",
                                                                                selectedContactId === contact.id ? "opacity-100" : "opacity-0"
                                                                            )}
                                                                        />
                                                                        {contact.name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </CommandList>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Asunto (Opcional)</label>
                                            <Input
                                                placeholder="Ej: Consulta sobre precios"
                                                value={newChatSubject}
                                                onChange={(e) => setNewChatSubject(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleCreateChat} disabled={creatingChat || !selectedContactId}>
                                            {creatingChat ? "Creando..." : "Iniciar Chat"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                            placeholder="Buscar en todos los chats..."
                            className="pl-8 bg-gray-50 border-0"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {conversations.length === 0 && !loading && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            {searchTerm ? "No se encontraron resultados." : "No hay conversaciones activas."}
                        </div>
                    )}

                    {loading && conversations.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-sm">
                            Cargando conversaciones...
                        </div>
                    )}

                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setSelectedId(conv.id)}
                            className={`p-4 border-b border-gray-100 hover:bg-white cursor-pointer transition-colors ${selectedId === conv.id ? 'bg-white border-l-4 border-l-cyan-500 shadow-sm' : ''}`}
                        >
                            <div className="flex justify-between items-start mb-1">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-gray-900 truncate max-w-[140px]">
                                        {conv.contact?.name || conv.subject || "Desconocido"}
                                    </span>
                                    {conv.channel?.type === 'whatsapp' && <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 h-5 px-1">WA</Badge>}
                                    {conv.channel?.type === 'email' && <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-700 h-5 px-1">Mail</Badge>}
                                </div>
                                <span className="text-xs text-gray-400 whitespace-nowrap">
                                    {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: es }).replace('alrededor de ', '')}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-1">
                                {conv.last_message?.content || "Sin mensajes"}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* ---------------- MIDDLE: CHAT WINDOW ---------------- */}
            {selectedId ? (
                <div className="flex-1 flex flex-col bg-white min-w-0">
                    {/* Header */}
                    <div className="h-16 border-b border-gray-100 flex items-center justify-between px-6 bg-white shrink-0">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                <AvatarFallback className="bg-cyan-100 text-cyan-700">
                                    {selectedConversation?.contact?.name?.substring(0, 2).toUpperCase() || "??"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="font-semibold text-gray-900">{selectedConversation?.contact?.name || "Chat"}</h2>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-green-600 flex items-center gap-1">
                                        <span className="block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        En línea (Bot activo)
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                            <Button variant="ghost" size="icon"><Phone className="h-5 w-5" /></Button>
                            <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
                        </div>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50" ref={scrollRef}>
                        {messages.length === 0 && (
                            <div className="text-center py-10 text-gray-400 text-sm">
                                Este es el inicio de tu conversación.
                            </div>
                        )}

                        {messages.map(msg => {
                            const isOutbound = msg.direction === 'outbound'
                            const isFile = msg.metadata?.is_file
                            return (
                                <div key={msg.id} className={`flex gap-4 max-w-2xl ${isOutbound ? 'ml-auto flex-row-reverse' : ''}`}>
                                    <Avatar className="h-8 w-8 mt-1">
                                        {isOutbound ? (
                                            <AvatarFallback className="bg-gray-900 text-white text-xs">YO</AvatarFallback>
                                        ) : (
                                            <AvatarFallback className="bg-cyan-100 text-cyan-700 text-xs">C</AvatarFallback>
                                        )}
                                    </Avatar>
                                    <div className="space-y-1">
                                        <div className={`p-3 rounded-2xl shadow-sm text-sm ${isOutbound
                                            ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none'
                                            : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                                            }`}>
                                            {isFile ? (
                                                <div className="flex items-center gap-2">
                                                    <Paperclip className="h-4 w-4" />
                                                    <span className="underline cursor-pointer">{msg.content}</span>
                                                </div>
                                            ) : (
                                                msg.content
                                            )}
                                        </div>
                                        <div className={`flex gap-1 px-1 ${isOutbound ? 'justify-end' : ''}`}>
                                            <span className="text-[10px] text-gray-400">
                                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-white border-t border-gray-100 shrink-0">
                        <div className="flex items-end gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200 focus-within:ring-2 focus-within:ring-cyan-500/20 focus-within:border-cyan-500 transition-all">
                            <Button variant="ghost" size="icon" className="h-10 w-10 text-gray-400 hover:text-gray-600">
                                <Paperclip className="h-5 w-5" />
                            </Button>
                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Escribe un mensaje... (Enter para enviar)"
                                className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 min-h-[2.5rem] py-2.5 text-sm text-gray-900 placeholder:text-gray-400"
                                rows={1}
                                disabled={sending}
                            />
                            <Button
                                onClick={handleSendMessage}
                                disabled={sending || !inputText.trim()}
                                size="icon"
                                className="h-10 w-10 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-lg shadow-cyan-500/20"
                            >
                                <Send className="h-5 w-5 text-white" />
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                    <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                        <Users className="h-12 w-12 text-gray-300" />
                    </div>
                    <p>Selecciona una conversación para comenzar</p>
                </div>
            )}

            {/* ---------------- RIGHT SIDEBAR: CONTEXT ---------------- */}
            {selectedConversation && (
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
                    {/* Demo Features */}
                    <div className="p-4 space-y-4">
                        {selectedConversation?.metadata?.tags && Array.isArray(selectedConversation.metadata.tags) && (
                            <div className="flex flex-wrap gap-2">
                                {selectedConversation.metadata.tags.map((tag: string) => (
                                    <Badge key={tag} variant={tag === 'Riesgo' ? 'destructive' : 'default'} className={tag === 'Riesgo' ? 'bg-red-500' : 'bg-green-600'}>
                                        {tag === 'Riesgo' ? '⚠️ Riesgo Detectado' : '💰 Oportunidad'}
                                    </Badge>
                                ))}
                            </div>
                        )}

                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                            <h4 className="flex items-center gap-2 font-bold text-indigo-900 text-xs mb-2">
                                <span className="text-indigo-500">✨</span> AI Copilot
                            </h4>
                            <p className="text-xs text-indigo-700 mb-2 leading-relaxed">
                                {selectedConversation?.metadata?.last_sentiment === 'negative'
                                    ? "Atención: El cliente parece molesto. Se recomienda empatía."
                                    : selectedConversation?.metadata?.last_sentiment === 'positive'
                                        ? "Positivo: El cliente muestra intención de compra."
                                        : "La IA está monitoreando esta conversación."}
                            </p>

                            {selectedConversation?.metadata?.suggested_action === 'create_opportunity' && (
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
                                            const res = await fetch('/api/opportunities', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    name: `Oportunidad Web: ${selectedConversation.contact?.name}`,
                                                    contact_id: selectedConversation.contact_id,
                                                    expected_revenue: 500,
                                                    stage_id: 'prospecting',
                                                    probability: 20
                                                })
                                            })
                                            const data = await res.json()
                                            if (data.success) {
                                                toast.success("Oportunidad creada exitosamente", { id: toastId })
                                            } else {
                                                toast.error(data.error || "Error al crear", { id: toastId })
                                            }
                                        } catch (e) {
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
                                onClick={handleSendBrochure}
                            >
                                Enviar Brochure PDF
                            </Button>
                        </div>

                        {/* Simulation Tool (Dev Mode) */}
                        <div className="bg-gray-50 p-3 rounded-lg border border-dashed border-gray-300">
                            <p className="text-[10px] text-gray-400 mb-2 font-mono uppercase">Simulador de Cliente</p>
                            <div className="flex gap-2">
                                <Input
                                    className="h-7 text-xs bg-white"
                                    placeholder="Simular respuesta..."
                                    onKeyDown={async (e) => {
                                        if (e.key === 'Enter') {
                                            const val = e.currentTarget.value
                                            e.currentTarget.value = ""
                                            try {
                                                await fetch('/api/chat/simulate', {
                                                    method: 'POST',
                                                    body: JSON.stringify({ conversation_id: selectedId, content: val })
                                                })
                                                toast.success("Mensaje simulado")
                                                loadConversations() // Refresh tags
                                            } catch (e) {
                                                toast.error("Error simulando")
                                            }
                                        }
                                    }}
                                />
                            </div>
                            <div className="flex gap-1 mt-2">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={async () => {
                                    await fetch('/api/chat/simulate', {
                                        method: 'POST',
                                        body: JSON.stringify({ conversation_id: selectedId, content: "Esto es una estafa, estoy muy molesto con el servicio!" })
                                    })
                                    loadConversations()
                                }}>😡 Enojo</Button>
                                <Button size="sm" variant="outline" className="h-6 text-[10px] w-full" onClick={async () => {
                                    await fetch('/api/chat/simulate', {
                                        method: 'POST',
                                        body: JSON.stringify({ conversation_id: selectedId, content: "Me interesa mucho el precio del plan pro, quiero comprar." })
                                    })
                                    loadConversations()
                                }}>💰 Compra</Button>
                            </div>
                        </div>

                        <Link href={`/contacts/${selectedConversation?.contact_id || ''}`} className="w-full block">
                            <Button
                                className="w-full border-gray-200 text-gray-600"
                                variant="outline"
                            >
                                Ver Perfil Completo
                            </Button>
                        </Link>
                    </div>
                </div>
            )}

        </div>
    )
}
