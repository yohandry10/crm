"use client"

import { useState } from "react"
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Loader2, Upload, CreditCard, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"

interface Quote {
    id: string
    quote_number: string
    total_amount: number
    contact?: {
        id: string
        name: string
    }
}

interface RegisterPaymentModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    quote: Quote | null
    onSuccess: () => void
}

export function RegisterPaymentModal({ open, onOpenChange, quote, onSuccess }: RegisterPaymentModalProps) {
    const [saving, setSaving] = useState(false)
    const [amount, setAmount] = useState("")
    const [paymentMethod, setPaymentMethod] = useState("transfer")
    const [proofUrl, setProofUrl] = useState("")
    const [notes, setNotes] = useState("")
    const [uploading, setUploading] = useState(false)

    // Reset form when modal opens
    const handleOpenChange = (isOpen: boolean) => {
        if (isOpen && quote) {
            setAmount(quote.total_amount?.toString() || "")
            setPaymentMethod("transfer")
            setProofUrl("")
            setNotes("")
        }
        onOpenChange(isOpen)
    }

    const handleUploadProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bucket', 'payment-proofs')

            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al subir archivo')

            setProofUrl(data.url)
            toast.success('Comprobante subido')
        } catch (error: any) {
            toast.error(error.message || 'Error al subir')
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = async () => {
        if (!quote) return
        if (!amount || Number(amount) <= 0) {
            toast.error('Ingresa un monto válido')
            return
        }

        setSaving(true)
        try {
            // First, convert quote to invoice if not already
            let invoiceId: string | null = null

            // Check if quote already has invoice
            const quoteRes = await fetch(`/api/quotes/${quote.id}`)
            const quoteData = await quoteRes.json()

            if (quoteData.data?.invoice_id) {
                invoiceId = quoteData.data.invoice_id
            } else {
                // Convert to invoice first
                const convertRes = await fetch(`/api/quotes/${quote.id}/convert`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                })
                const convertData = await convertRes.json()
                if (!convertRes.ok) throw new Error(convertData.error || 'Error al crear factura')
                invoiceId = convertData.data?.invoice_id
            }

            if (!invoiceId) {
                throw new Error('No se pudo obtener la factura')
            }

            // Create payment record
            const paymentRes = await fetch('/api/payments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    invoice_id: invoiceId,
                    amount: Number(amount),
                    payment_method: paymentMethod,
                    notes: notes || null,
                    proof_url: proofUrl || null,
                    gateway: 'manual',
                    status: proofUrl ? 'pending' : 'completed',
                    transaction_id: proofUrl ? `proof:${quote.id}:${Date.now()}` : `manual:${quote.id}:${Date.now()}`,
                })
            })

            const paymentData = await paymentRes.json()
            if (!paymentRes.ok) throw new Error(paymentData.error || 'Error al registrar pago')

            // Update quote status to paid
            await fetch(`/api/quotes/${quote.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'paid' })
            })

            toast.success('Pago registrado exitosamente')
            onOpenChange(false)
            onSuccess()
        } catch (error: any) {
            toast.error(error.message || 'Error al registrar pago')
        } finally {
            setSaving(false)
        }
    }

    if (!quote) return null

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-green-600" />
                        Registrar Pago
                    </DialogTitle>
                    <DialogDescription>
                        Cotización #{quote.quote_number} • Cliente: {quote.contact?.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Amount */}
                    <div className="space-y-2">
                        <Label>Monto recibido</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-muted-foreground">S/</span>
                            <Input
                                type="number"
                                step="0.01"
                                className="pl-10"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder={quote.total_amount?.toFixed(2)}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Total de cotización: {formatCurrency(quote.total_amount)}
                        </p>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <Label>Método de pago</Label>
                        <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="transfer">Transferencia Bancaria</SelectItem>
                                <SelectItem value="yape">Yape</SelectItem>
                                <SelectItem value="plin">Plin</SelectItem>
                                <SelectItem value="cash">Efectivo</SelectItem>
                                <SelectItem value="card">Tarjeta</SelectItem>
                                <SelectItem value="other">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Proof Upload */}
                    <div className="space-y-2">
                        <Label>Comprobante de pago (opcional)</Label>
                        <div className="flex gap-2">
                            <Input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleUploadProof}
                                disabled={uploading}
                                className="flex-1"
                            />
                            {uploading && <Loader2 className="w-5 h-5 animate-spin" />}
                            {proofUrl && <CheckCircle className="w-5 h-5 text-green-500" />}
                        </div>
                        {proofUrl && (
                            <p className="text-xs text-green-600">
                                ✓ Comprobante subido
                            </p>
                        )}
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <Label>Notas (opcional)</Label>
                        <Textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ej: Cliente pagó en efectivo en oficina"
                            rows={2}
                        />
                    </div>

                    {/* Submit */}
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={handleSubmit}
                        disabled={saving || !amount}
                    >
                        {saving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando...</>
                        ) : (
                            <><CreditCard className="w-4 h-4 mr-2" /> Registrar Pago</>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
