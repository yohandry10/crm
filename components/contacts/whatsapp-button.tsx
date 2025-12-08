"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { MessageCircle, Send, Loader2, ExternalLink } from "lucide-react"
import { generateWhatsAppLink, QUICK_MESSAGES } from "@/lib/whatsapp"

interface WhatsAppButtonProps {
  phone: string
  contactName: string
  contactId?: string
  variant?: "default" | "outline" | "ghost"
  size?: "default" | "sm" | "lg" | "icon"
}

export function WhatsAppButton({
  phone,
  contactName,
  contactId,
  variant = "outline",
  size = "sm",
}: WhatsAppButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [customMessage, setCustomMessage] = useState("")
  const [sending, setSending] = useState(false)

  const openWhatsApp = (message?: string) => {
    const link = generateWhatsAppLink(phone, message)
    window.open(link, "_blank")
  }

  const sendViaAPI = async (message: string) => {
    setSending(true)
    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: phone,
          type: "text",
          content: message,
          contactId,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success("Mensaje enviado")
        setDialogOpen(false)
        setCustomMessage("")
      } else {
        // Fallback to WhatsApp Web
        toast.info("Abriendo WhatsApp Web...")
        openWhatsApp(message)
      }
    } catch (error) {
      // Fallback to WhatsApp Web
      openWhatsApp(message)
    } finally {
      setSending(false)
    }
  }

  const quickMessages = [
    { key: "greeting", label: "Saludo" },
    { key: "followup", label: "Seguimiento" },
    { key: "thank_you", label: "Agradecimiento" },
  ] as const

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className="gap-2">
            <MessageCircle className="w-4 h-4 text-green-600" />
            {size !== "icon" && "WhatsApp"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Mensajes rápidos</DropdownMenuLabel>
          {quickMessages.map((msg) => (
            <DropdownMenuItem
              key={msg.key}
              onClick={() => openWhatsApp(QUICK_MESSAGES[msg.key](contactName))}
            >
              {msg.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialogOpen(true)}>
            <Send className="w-4 h-4 mr-2" />
            Mensaje personalizado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openWhatsApp()}>
            <ExternalLink className="w-4 h-4 mr-2" />
            Abrir chat
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar WhatsApp a {contactName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Escribe tu mensaje..."
              rows={4}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => openWhatsApp(customMessage)}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir en WhatsApp
              </Button>
              <Button
                onClick={() => sendViaAPI(customMessage)}
                disabled={!customMessage || sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar via API
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
