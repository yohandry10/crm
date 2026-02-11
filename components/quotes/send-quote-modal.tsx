"use client"

import { useState, useEffect, useCallback } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Mail, MessageCircle, Copy, Check } from "lucide-react"
import { toast } from "sonner"

interface Quote {
    id: string
    quote_number: string
    total_amount: number
    contact?: {
        name: string
        email?: string
        phone?: string
    }
}

interface SendQuoteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    quote: Quote | null
    onSent: () => void
}

export function SendQuoteModal({ open, onOpenChange, quote, onSent }: SendQuoteModalProps) {
    const [method, setMethod] = useState<"email" | "whatsapp" | null>(null)
    const [email, setEmail] = useState("")
    const [phone, setPhone] = useState("")
    const [message, setMessage] = useState("")
    const [sending, setSending] = useState(false)
    const [paymentLink, setPaymentLink] = useState("")
    const [copied, setCopied] = useState(false)

    const getQuoteNumber = (q: Quote) => q.quote_number || q.id?.slice(0, 8) || ""

    // Reset form when modal opens
    useEffect(() => {
        if (open && quote) {
            setMethod(null)
            setEmail(quote.contact?.email || "")
            setPhone(quote.contact?.phone || "")
            setPaymentLink("")
            setCopied(false)

            const quoteNumber = getQuoteNumber(quote)
            const total = Number(quote.total_amount || 0).toFixed(2)

            // Generate default message
            const defaultMessage = `Hola ${quote.contact?.name || ""},

Te envío la cotización #${quoteNumber} por S/ ${total}.

Puedes ver los detalles y realizar el pago en el siguiente enlace:
[LINK]

¡Gracias por tu preferencia!`
            setMessage(defaultMessage)
        }
    }, [open, quote])

    const generatePaymentLink = useCallback(async () => {
        if (!quote) return

        try {
            const res = await fetch('/api/payment-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quote_id: quote.id, expires_days: 30 })
            })
            const data = await res.json()

            if (data.success) {
                setPaymentLink(data.data.link)
                setMessage(prev => prev.replace('[LINK]', data.data.link))
            }
        } catch (error) {
            console.error("Error generating link:", error)
        }
    }, [quote])

    // Generate payment link when method is selected
    useEffect(() => {
        if (method && quote && !paymentLink) {
            generatePaymentLink()
        }
    }, [method, quote, paymentLink, generatePaymentLink])

    const handleSendEmail = async () => {
        if (!email || !quote) {
            toast.error("Ingresa un correo electrónico")
            return
        }

        setSending(true)
        try {
            // Send quote via email API
            const res = await fetch(`/api/quotes/${quote.id}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: 'email',
                    to: email,
                    message,
                    payment_link: paymentLink
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Error al enviar")

            // Update quote status to sent
            await fetch(`/api/quotes/${quote.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'sent' })
            })

            toast.success("Cotización enviada por correo")
            onOpenChange(false)
            onSent()
        } catch (error: any) {
            toast.error(error.message || "Error al enviar")
        } finally {
            setSending(false)
        }
    }

    const handleSendWhatsApp = async () => {
        if (!phone || !quote) {
            toast.error("Ingresa un número de teléfono")
            return
        }

        setSending(true)
        try {
            // Clean phone number (remove spaces, dashes)
            const cleanPhone = phone.replace(/\D/g, '')

            // Encode message for WhatsApp
            const encodedMessage = encodeURIComponent(message)

            // Open WhatsApp link
            const waLink = `https://wa.me/${cleanPhone}?text=${encodedMessage}`
            window.open(waLink, '_blank')

            // Update quote status to sent
            await fetch(`/api/quotes/${quote.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'sent' })
            })

            toast.success("Abriendo WhatsApp...")
            onOpenChange(false)
            onSent()
        } catch (error: any) {
            toast.error(error.message || "Error al enviar")
        } finally {
            setSending(false)
        }
    }

    const handleCopyLink = async () => {
        if (paymentLink) {
            await navigator.clipboard.writeText(paymentLink)
            setCopied(true)
            toast.success("Link copiado al portapapeles")
            setTimeout(() => setCopied(false), 2000)
        }
    }

    if (!quote) return null

    const quoteNumber = getQuoteNumber(quote)
    const total = Number(quote.total_amount || 0).toFixed(2)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] sm:max-w-md w-full">
                <DialogHeader>
                    <DialogTitle>Enviar Cotización</DialogTitle>
                    <DialogDescription>
                        Cotización #{quoteNumber} • S/ {total}
                    </DialogDescription>
                </DialogHeader>
                        >
                {sending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                    <><Mail className="w-4 h-4 mr-2" /> Enviar por Email</>
                )}
            </Button>
        </div>
    )
}

{/* Step 2b: WhatsApp form */ }
{
    method === "whatsapp" && (
        <div className="space-y-4">
            <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setMethod(null)}
            >
                ← Cambiar método
            </Button>

            <div className="space-y-2">
                <Label>Número de WhatsApp (con código de país)</Label>
                <Input
                    type="tel"
                    placeholder="51987654321"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                    Ejemplo: 51 para Perú + número sin espacios
                </p>
            </div>

            <div className="space-y-2">
                <Label>Mensaje</Label>
                <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={6}
                    className="text-sm"
                />
            </div>

            <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleSendWhatsApp}
                disabled={sending || !phone}
            >
                {sending ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Abriendo...</>
                ) : (
                    <><MessageCircle className="w-4 h-4 mr-2" /> Abrir WhatsApp</>
                )}
            </Button>
        </div>
    )
}
            </DialogContent >
        </Dialog >
    )
}
