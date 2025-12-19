"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  MessageCircle, X, Send, Bot, User, Sparkles, Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"

// --- TYPES ---

type Intent =
  | "GREETING" | "HELP" | "MODULES_LIST"
  | "SALES" | "LEADS" | "INVOICING" | "QUOTES" | "WORKFLOWS" | "CALENDAR" | "TASKS" | "ANALYTICS" | "SETTINGS"
  | "INVENTORY" | "PRODUCTS" | "CAMPAIGNS" | "FORMS" | "INTEGRATIONS"
  | "YES" | "NO" | "DETAILS" | "UNKNOWN"

interface ChatState {
  currentModule: "NONE" | "SALES" | "LEADS" | "INVOICING" | "QUOTES" | "WORKFLOWS" | "CALENDAR" | "TASKS" | "ANALYTICS" | "SETTINGS" | "INVENTORY" | "PRODUCTS" | "CAMPAIGNS" | "FORMS" | "INTEGRATIONS"
  conversationStep: "IDLE" | "OFFER_DETAILS" | "SHOWING_DETAILS"
}

function isModuleKey(value: string): value is ChatState["currentModule"] {
  return [
    "NONE",
    "SALES",
    "LEADS",
    "INVOICING",
    "QUOTES",
    "WORKFLOWS",
    "CALENDAR",
    "TASKS",
    "ANALYTICS",
    "SETTINGS",
    "INVENTORY",
    "PRODUCTS",
    "CAMPAIGNS",
    "FORMS",
    "INTEGRATIONS",
  ].includes(value)
}

interface Message {
  id: string
  content: string
  isAi: boolean
  timestamp: Date
  actions?: string[]
}

interface TopicData {
  title: string
  summary: string
  details: string
  actions: string[]
}

// --- INITIAL DEFAULT STATE (Skeleton/Fallback) ---

const DEFAULT_TOPICS: Record<string, TopicData> = {
  SALES: {
    title: "Ventas",
    summary: "💰 **Ventas**\n\nCargando datos del pipeline...",
    details: "...",
    actions: ["Ver Pipeline"]
  },
  LEADS: {
    title: "Leads",
    summary: "👥 **Leads**\n\nCargando leads recientes...",
    details: "...",
    actions: ["Ver Leads"]
  },
  INVOICING: {
    title: "Facturación",
    summary: "💳 **Facturación**\n\nBuscando facturas vencidas...",
    details: "...",
    actions: ["Ver Facturas"]
  },
  QUOTES: {
    title: "Cotizaciones",
    summary: "📄 **Cotizaciones**\n\nConsultando cotizaciones...",
    details: "...",
    actions: ["Ver Cotizaciones"]
  },
  WORKFLOWS: {
    title: "Automatizaciones",
    summary: "⚡ **Workflows**\n\nSistemas operativos.",
    details: "No hay alertas de sistema críticas por el momento.",
    actions: ["Ver Workflows"]
  },
  CALENDAR: {
    title: "Calendario",
    summary: "📅 **Calendario**\n\nRevisando agenda...",
    details: "...",
    actions: ["Ver Calendario"]
  },
  TASKS: {
    title: "Tareas",
    summary: "✅ **Tareas**\n\nBuscando pendientes...",
    details: "...",
    actions: ["Ir a Tareas"]
  },
  ANALYTICS: {
    title: "Reportes",
    summary: "📊 **Analytics**\n\nCalculando métricas...",
    details: "...",
    actions: ["Ver Dashboard"]
  },
  SETTINGS: {
    title: "Configuración",
    summary: "⚙️ **Ajustes**\n\nSistema operativo.",
    details: "...",
    actions: ["Ir a Ajustes"]
  },
  INVENTORY: {
    title: "Inventario",
    summary: "📦 **Inventario**\n\nVerificando stock...",
    details: "...",
    actions: ["Ver Inventario"]
  },
  PRODUCTS: {
    title: "Productos",
    summary: "🏷️ **Productos**\n\nCargando catálogo...",
    details: "...",
    actions: ["Ver Productos"]
  },
  CAMPAIGNS: {
    title: "Campañas",
    summary: "📢 **Marketing**\n\nAnalizando campañas...",
    details: "...",
    actions: ["Ver Campañas"]
  },
  FORMS: {
    title: "Formularios",
    summary: "📝 **Formularios**\n\nSin actividad reciente.",
    details: "...",
    actions: ["Ver Formularios"]
  },
  INTEGRATIONS: {
    title: "Integraciones",
    summary: "🔌 **Integraciones**\n\nSistemas conectados.",
    details: "...",
    actions: ["Ver Integraciones"]
  }
}

// --- HELPER FUNCTIONS ---

const normalizeText = (text: string) => {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)
}

const detectIntent = (input: string): Intent => {
  const text = normalizeText(input)

  // 1. General Info / Meta (HIGHEST PRIORITY)
  if (text.includes("modulo") || text.includes("modulos") || (text.includes("que") && text.includes("haces")) || text.includes("lista") || text.includes("revisar")) return "MODULES_LIST"
  if (text.includes("tutorial") || text.includes("aprender") || text.includes("guia") || text.includes("ensena") || text.includes("ayuda") || text.includes("opciones") || text.includes("menu")) return "HELP"
  if (text.includes("hola") || text.includes("buenos") || text.includes("buenas")) return "GREETING"

  // 2. Specific Modules (Longer/More Specific First)
  if (text.includes("inventario") || text.includes("stock") || text.includes("existencia") || text.includes("almacen")) return "INVENTORY"
  if (text.includes("producto") || text.includes("servicio") || text.includes("catalogo") || text.includes("items")) return "PRODUCTS"
  if (text.includes("cotizacion") || text.includes("presupuesto") || text.includes("proforma") || text.includes("oferta")) return "QUOTES"
  if (text.includes("factura") || text.includes("cobro") || text.includes("pago") || text.includes("vencida") || text.includes("finanza")) return "INVOICING"
  if (text.includes("lead") || text.includes("contacto") || text.includes("prospecto")) return "LEADS"
  if (text.includes("campana") || text.includes("marketing") || text.includes("email") || text.includes("promo")) return "CAMPAIGNS"
  if (text.includes("workflow") || text.includes("auto") || text.includes("flujo") || text.includes("bot")) return "WORKFLOWS"
  if (text.includes("calendar") || text.includes("agenda") || text.includes("reunion") || text.includes("cita") || text.includes("evento")) return "CALENDAR"
  if (text.includes("tarea") || (text.includes("pendiente") && !text.includes("independiente")) || text.includes("hacer") || text.includes("tasks")) return "TASKS"
  if (text.includes("analytic") || text.includes("reporte") || text.includes("grafic") || text.includes("metrica") || text.includes("kpi")) return "ANALYTICS"
  if (text.includes("config") || text.includes("ajuste") || text.includes("cuenta") || text.includes("perfil") || text.includes("plan")) return "SETTINGS"
  if (text.includes("form") || text.includes("encuesta") || text.includes("captacion")) return "FORMS"
  if (text.includes("integra") || text.includes("api") || text.includes("whatsapp") || text.includes("strip")) return "INTEGRATIONS"

  // 3. Broader Matches (Check these LAST)
  // "venta" matches "inventario", so we check it after inventory.
  if (text.includes("venta") || text.includes("pipeline") || text.includes("dinero") || text.includes("oportunidad") || text.includes("negoci")) return "SALES"

  // 4. Flow Controls
  if (text.includes("si") || text.includes("claro") || text.includes("por favor") || text.includes("ver") || text.includes("mostrar") || text.includes("quiero")) return "YES"
  if (text.includes("no") || text.includes("gracias") || text.includes("cancelar")) return "NO"
  if (text.includes("detalle") || text.includes("mas info") || text.includes("profundiz") || text.includes("explica")) return "DETAILS"

  return "UNKNOWN"
}

// --- MAIN COMPONENT ---

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "¡Hola! Soy NEON AI. 👋\n\nEstoy conectado a **tu base de datos real**.\n\n¿Qué módulo quieres auditar hoy?",
      isAi: true,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [topicState, setTopicState] = useState<Record<string, TopicData>>(DEFAULT_TOPICS)
  const [chatState, setChatState] = useState<ChatState>({ currentModule: "NONE", conversationStep: "IDLE" })
  const scrollRef = useRef<HTMLDivElement>(null)

  // --- FETCH REAL DATA ---
  useEffect(() => {
    // Only fetch if open or on mount to save resources
    if (isOpen) {
      fetchAllData()
    }
  }, [isOpen])

  const fetchAllData = async () => {
    try {
      console.log("NEON AI: Connecting to Neural Core (Database)...")
      const [
        oppsRes, leadsRes, invoicesRes, quotesRes,
        inventoryRes, productsRes, campaignsRes, tasksRes,
        formsRes, workflowsRes, integrationsRes
      ] = await Promise.allSettled([
        fetch('/api/opportunities').then(r => r.json()),
        fetch('/api/contacts').then(r => r.json()),
        fetch('/api/invoices').then(r => r.json()),
        fetch('/api/quotes').then(r => r.json()),
        fetch('/api/inventory').then(r => r.json()),
        fetch('/api/products').then(r => r.json()),
        fetch('/api/campaigns').then(r => r.json()),
        fetch('/api/tasks').then(r => r.json()),
        fetch('/api/forms').then(r => r.json()),
        fetch('/api/workflows').then(r => r.json()),
        fetch('/api/integrations').then(r => r.json())
      ])

      setTopicState(prev => {
        const next = { ...prev }

        // 1. SALES
        if (oppsRes.status === "fulfilled" && oppsRes.value.success) {
          const opps = oppsRes.value.data || []
          const totalPipeline = opps.reduce((sum: number, op: any) => sum + (Number(op.value) || 0), 0)
          const activeDeals = opps.length

          next.SALES = {
            title: "Ventas",
            summary: `💰 **Ventas**\n\nTienes **${activeDeals} oportunidades** abiertas por un valor total de **${formatCurrency(totalPipeline)}**.`,
            details: `🔍 **Detalle Real**\n\nDe los ${activeDeals} tratos, el mayor es de valor ${formatCurrency(Math.max(...opps.map((o: any) => Number(o.value) || 0)))}.\n¿Quieres ir al tablero Kanban?`,
            actions: ["Ver Pipeline", "Crear Oportunidad"]
          }
        }

        // 2. LEADS
        if (leadsRes.status === "fulfilled" && leadsRes.value.success) {
          const leads = (leadsRes.value.data || []).filter((l: any) => l.lead_status)
          const hotLeads = leads.filter((l: any) => l.lead_status === 'hot').length

          next.LEADS = {
            title: "Leads",
            summary: `👥 **Leads**\n\nHay **${leads.length} leads** registrados en total.\nAtención: Tienes **${hotLeads} leads calientes** esperando.`,
            details: `🔥 **Oportunidad de Conversión**\n\nLos ${hotLeads} leads calientes tienen alta probabilidad de cierre. Te recomiendo contactarlos hoy mismo.`,
            actions: ["Ver Leads Hot", "Contactar"]
          }
        }

        // 3. INVOICING
        if (invoicesRes.status === "fulfilled" && invoicesRes.value.success) {
          const invoices = invoicesRes.value.data || []
          const overdue = invoices.filter((i: any) => i.status === 'overdue')
          const overdueAmount = overdue.reduce((sum: number, i: any) => sum + (Number(i.total) || 0), 0)

          next.INVOICING = {
            title: "Facturación",
            summary: `💳 **Facturación**\n\nHay **${invoices.length} facturas** registradas.`,
            details: overdue.length > 0
              ? `⚠️ **Alerta de Cobranza**\n\nTienes **${overdue.length} facturas vencidas** por un total de **${formatCurrency(overdueAmount)}**.\n¿Enviamos recordatorios?`
              : "✅ **Todo en orden**\nNo hay facturas vencidas en este momento.",
            actions: ["Ver Vencidas", "Nueva Factura"]
          }
        }

        // 4. QUOTES
        if (quotesRes.status === "fulfilled" && quotesRes.value.success) {
          const quotes = quotesRes.value.data || []
          const approved = quotes.filter((q: any) => q.status === 'accepted')

          next.QUOTES = {
            title: "Cotizaciones",
            summary: `📄 **Cotizaciones**\n\nSe han emitido **${quotes.length} cotizaciones**.`,
            details: `✅ **Aprobadas**\n\nTienes **${approved.length} cotizaciones aceptadas** listas para facturar.\n¿Quieres procesarlas?`,
            actions: ["Ver Cotizaciones", "Convertir a Factura"]
          }
        }

        // 5. INVENTORY
        if (inventoryRes.status === "fulfilled" && inventoryRes.value.success) {
          const items = inventoryRes.value.data || []
          const lowStock = items.filter((i: any) => i.quantity < 5).length

          next.INVENTORY = {
            title: "Inventario",
            summary: `📦 **Inventario**\n\nControlando **${items.length} SKUs** diferentes.`,
            details: lowStock > 0
              ? `⚠️ **Stock Crítico**\n\nHay **${lowStock} productos** con menos de 5 unidades. Revisa el inventario urgente.`
              : "✅ **Stock Saludable**\nTodos los productos tienen niveles adecuados.",
            actions: ["Ver Inventario", "Ajustar Stock"]
          }
        }

        // 6. PRODUCTS
        if (productsRes.status === "fulfilled" && productsRes.value.success) {
          const products = productsRes.value.data || []
          const active = products.filter((p: any) => p.is_active).length

          next.PRODUCTS = {
            title: "Productos",
            summary: `🏷️ **Productos**\n\nTienes **${products.length} items** en tu catálogo.`,
            details: `ℹ️ **Estado**\n\n${active} activos y visibles para venta. ${products.length - active} inactivos o archivados.`,
            actions: ["Ver Catálogo", "Nuevo Producto"]
          }
        }

        // 7. CAMPAIGNS
        if (campaignsRes.status === "fulfilled" && campaignsRes.value.success) {
          const campaigns = campaignsRes.value.data || []
          const active = campaigns.filter((c: any) => c.status === 'active').length

          next.CAMPAIGNS = {
            title: "Campañas",
            summary: `📢 **Marketing**\n\n**${campaigns.length} campañas** registradas.`,
            details: active > 0
              ? `🚀 **En Curso**\n\nHay **${active} campañas activas** ahora mismo enviando correos/mensajes.`
              : "⏸️ **Sin Actividad**\nNo hay campañas activas en este momento.",
            actions: ["Ver Campañas", "Crear Campaña"]
          }
        }

        // 8. TASKS
        if (tasksRes.status === "fulfilled" && tasksRes.value.success) {
          const tasks = tasksRes.value.data || []
          const pending = tasks.filter((t: any) => t.status !== 'completed')
          const high = pending.filter((t: any) => t.priority === 'high').length

          next.TASKS = {
            title: "Tareas",
            summary: `✅ **Gestión de Tareas**\n\nTienes **${pending.length} tareas pendientes**.`,
            details: high > 0
              ? `🚨 **Prioridad Alta**\n\nAtención: **${high} tareas urgentes** requieren tu acción inmediata.`
              : "👍 **Al día**\nNo tienes tareas urgentes pendientes.",
            actions: ["Ir a Tareas", "Mis Pendientes"]
          }
        }

        // 9. FORMS
        if (formsRes.status === "fulfilled" && formsRes.value.success) {
          const forms = formsRes.value.data || []
          const active = forms.filter((f: any) => f.published).length

          next.FORMS = {
            title: "Formularios",
            summary: `📝 **Formularios**\n\nTienes **${active} formularios activos** captando datos.`,
            details: `📊 **Conversión**\n\nSe han recibido respuestas recientes en ${active} formularios. Utiliza estos datos para generar más leads.`,
            actions: ["Ver Formularios", "Nuevo Formulario"]
          }
        }

        // 10. WORKFLOWS
        if (workflowsRes.status === "fulfilled" && workflowsRes.value.success) {
          const workflows = workflowsRes.value.data || []
          const active = workflows.filter((w: any) => w.is_active).length

          next.WORKFLOWS = {
            title: "Automatizaciones",
            summary: `⚡ **Workflows**\n\n**${active} automatizaciones** están corriendo ahora mismo.`,
            details: "🤖 **Sistema Operativo**\n\nTodo funciona correctamente. Tus bots están procesando tareas en segundo plano.",
            actions: ["Ver Workflows", "Nuevo Workflow"]
          }
        }

        // 11. INTEGRATIONS
        if (integrationsRes.status === "fulfilled" && integrationsRes.value.success) {
          const integrations = integrationsRes.value.data || []
          const connected = integrations.filter((i: any) => i.status === 'connected').length

          next.INTEGRATIONS = {
            title: "Integraciones",
            summary: `🔌 **Integraciones**\n\nHay **${connected} herramientas conectadas** al CRM.`,
            details: connected > 0
              ? "🔗 **Conexiones Activas**\nEstado saludable en tus integraciones (WhatsApp, Email, etc)."
              : "❌ **Sin Conexiones**\nNo tienes integraciones activas. Conecta WhatsApp o tu Email para potenciar el CRM.",
            actions: ["Ver Integraciones", "Conectar Apps"]
          }
        }

        return next
      })

    } catch (error) {
      console.error("Error connecting chatbot to real data:", error)
      // Keep defaults if basic fetch fails
    }
  }

  // --- AUTO SCROLL ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async (textOverride?: string) => {
    const text = textOverride || input
    if (!text.trim() || isLoading) return

    // 1. User Message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: text,
      isAi: false,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // 2. Process Logic
    setTimeout(() => {
      const response = processInput(text)

      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        content: response.text,
        isAi: true,
        timestamp: new Date(),
        actions: response.actions
      }])
      setIsLoading(false)
    }, 1000) // Faster response for local data
  }

  const processInput = (text: string) => {
    const intent = detectIntent(text)
    let responseText = ""
    let nextState = { ...chatState }
    let actions: string[] = []

    // Helper: Check context
    const isRelatedToCurrent =
      (chatState.currentModule !== "NONE" && intent === chatState.currentModule) ||
      (chatState.currentModule === "INVOICING" && normalizeText(text).includes("vencida"))

    // A. Active Flow Priority
    if (chatState.conversationStep === "OFFER_DETAILS") {
      if (intent === "YES" || intent === "DETAILS" || isRelatedToCurrent) {
        if (chatState.currentModule !== "NONE") {
          const moduleData = topicState[chatState.currentModule]
          if (moduleData) {
            responseText = moduleData.details
            nextState = { ...chatState, conversationStep: "SHOWING_DETAILS" }
          }
        }
      } else if (intent === "NO") {
        responseText = "Bien. ¿Qué más quieres consultar de tu base de datos?"
        nextState = { currentModule: "NONE", conversationStep: "IDLE" }
      } else if (intent !== "UNKNOWN") {
        // Intent switch handled below
      } else {
        if (normalizeText(text).includes("ver") || normalizeText(text).includes("ir")) {
          if (chatState.currentModule !== "NONE") {
            responseText = topicState[chatState.currentModule].details
            nextState = { ...chatState, conversationStep: "SHOWING_DETAILS" }
          }
        }
      }
    }

    // B. Main Logic
    if (!responseText) {
      switch (intent) {
        case "GREETING":
          responseText = "¡Hola! Conexión a base de datos establecida 🟢.\n¿Quieres ver el resumen de Ventas, Facturación o Inventario?"
          nextState = { currentModule: "NONE", conversationStep: "IDLE" }
          break
        case "HELP":
        case "MODULES_LIST":
          responseText = "Tengo acceso en tiempo real a:\n\n" +
            topicState.SALES.summary.split('\n')[0] + "\n" +
            topicState.INVOICING.summary.split('\n')[0] + "\n" +
            topicState.INVENTORY.summary.split('\n')[0] + "\n" +
            topicState.CAMPAIGNS.summary.split('\n')[0] + "\n" +
            "\nDi el nombre de un módulo para ver sus datos reales."
          nextState = { currentModule: "NONE", conversationStep: "IDLE" }
          actions = ["Ver Ventas", "Ver Inventario"]
          break
        case "SALES":
        case "LEADS":
        case "INVOICING":
        case "QUOTES":
        case "WORKFLOWS":
        case "CALENDAR":
        case "TASKS":
        case "ANALYTICS":
        case "SETTINGS":
        case "INVENTORY":
        case "PRODUCTS":
        case "CAMPAIGNS":
        case "FORMS":
        case "INTEGRATIONS":
          if (isModuleKey(intent) && topicState[intent]) {
            responseText = topicState[intent].summary + "\n\n¿Quieres ver el detalle?"
            nextState = { currentModule: intent, conversationStep: "OFFER_DETAILS" }
            actions = topicState[intent].actions
          }
          break
        default:
          responseText = "No entendí eso. Intenta con 'Resumen de Ventas', 'Ver Inventario' o 'Facturas Vencidas'. Estoy leyendo tu data real."
          nextState = { currentModule: "NONE", conversationStep: "IDLE" }
          actions = ["Ver Estado Ventas", "Ver Alertas Stock"]
      }
    }

    setChatState(nextState)
    return { text: responseText, actions }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
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

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] rounded-3xl overflow-hidden shadow-2xl shadow-black/50"
          >
            {/* Glass Background */}
            <div className="absolute inset-0 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/[0.08] rounded-3xl" />
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
                    <span className="text-xs text-white/40">Connected to DB</span>
                  </div>
                </div>
              </div>
              <motion.button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] flex items-center justify-center transition-colors"
                whileHover={{ scale: 1.05 }}
              >
                <X className="w-4 h-4 text-white/60" />
              </motion.button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="relative h-[430px] overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
            >
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={cn(
                    "flex flex-col gap-1",
                    !message.isAi ? "items-end" : "items-start"
                  )}
                >
                  <div className={cn("flex gap-3 max-w-[85%]", !message.isAi && "flex-row-reverse")}>
                    <div className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center",
                      message.isAi
                        ? "bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20"
                        : "bg-white/[0.08] border border-white/[0.08]"
                    )}>
                      {message.isAi ? <Bot className="w-4 h-4 text-cyan-400" /> : <User className="w-4 h-4 text-white/60" />}
                    </div>

                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                      message.isAi
                        ? "bg-white/[0.05] border border-white/[0.06] text-white/80 rounded-tl-md"
                        : "bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-tr-md"
                    )}>
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  {message.actions && (
                    <div className="flex gap-2 ml-11 overflow-x-auto max-w-full pb-2 scrollbar-hide">
                      {message.actions.map(action => (
                        <motion.button
                          key={action}
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          onClick={() => handleSend(action)}
                          className="text-xs bg-white/10 hover:bg-white/20 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                        >
                          {action}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-white/[0.05] border border-white/[0.06]">
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="absolute bottom-0 left-0 right-0 px-4 py-4 border-t border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-xl">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] focus-within:border-cyan-500/30 transition-colors">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tu mensaje..."
                  className="flex-1 bg-transparent border-0 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
