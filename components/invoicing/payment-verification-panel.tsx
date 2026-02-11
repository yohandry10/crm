"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, XCircle, Image, ExternalLink, Clock } from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface PendingPayment {
    id: string
    amount: number
    proof_url: string
    payment_method: string
    status: string
    created_at: string
    notes?: string
    invoice?: {
        id: string
        invoice_number: string
        total: number
        contact?: {
            name: string
            email: string
        }
    }
}

interface PaymentVerificationPanelProps {
    onPaymentVerified?: () => void
}

export function PaymentVerificationPanel({ onPaymentVerified }: PaymentVerificationPanelProps) {
    const [payments, setPayments] = useState<PendingPayment[]>([])
    const [loading, setLoading] = useState(true)
    const [processing, setProcessing] = useState<string | null>(null)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    useEffect(() => {
        fetchPendingPayments()
    }, [])

    const fetchPendingPayments = async () => {
        try {
            setLoading(true)
            const res = await fetch('/api/payments?status=pending&limit=50')
            const data = await res.json()

            if (data.success) {
                // Filter only payments with proof_url
                const withProof = (data.data || []).filter((p: PendingPayment) => p.proof_url)
                setPayments(withProof)
            }
        } catch (error) {
            console.error("Error fetching pending payments:", error)
        } finally {
            setLoading(false)
        }
    }

    const handleVerify = async (paymentId: string, approve: boolean) => {
        setProcessing(paymentId)
        try {
            const res = await fetch(`/api/payments/${paymentId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    status: approve ? 'completed' : 'failed',
                    verified_at: new Date().toISOString()
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Error al verificar')

            toast.success(approve ? 'Pago aprobado' : 'Pago rechazado')
            fetchPendingPayments()
            onPaymentVerified?.()
        } catch (error: any) {
            toast.error(error.message || 'Error al procesar')
        } finally {
            setProcessing(null)
        }
    }

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                </CardContent>
            </Card>
        )
    }

    if (payments.length === 0) {
        return null // Don't show panel if no pending payments
    }

    return (
        <>
            <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-amber-800">
                                <Clock className="w-5 h-5" />
                                Pagos Pendientes de Verificación
                            </CardTitle>
                            <CardDescription className="text-amber-700">
                                Revisa los comprobantes y aprueba o rechaza los pagos
                            </CardDescription>
                        </div>
                        <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                            {payments.length} pendiente{payments.length !== 1 ? 's' : ''}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {payments.map((payment) => (
                            <div
                                key={payment.id}
                                className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-white rounded-lg border border-amber-100 shadow-sm gap-4 sm:gap-0"
                            >
                                <div className="flex items-start sm:items-center gap-4 w-full sm:w-auto">
                                    {/* Proof Image Preview */}
                                    <button
                                        onClick={() => setPreviewImage(payment.proof_url)}
                                        className="w-16 h-16 rounded-lg border-2 border-amber-200 overflow-hidden hover:border-amber-400 transition-colors flex-shrink-0"
                                    >
                                        {payment.proof_url ? (
                                            <img
                                                src={payment.proof_url}
                                                alt="Comprobante"
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement
                                                    target.style.display = 'none'
                                                    target.parentElement?.classList.add('bg-muted', 'flex', 'items-center', 'justify-center')
                                                    const icon = document.createElement('span')
                                                    icon.innerHTML = '📄'
                                                    target.parentElement?.appendChild(icon)
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full bg-muted flex items-center justify-center">
                                                <Image className="w-6 h-6 text-muted-foreground" />
                                            </div>
                                        )}
                                    </button>

                                    {/* Payment Info */}
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-lg">
                                                {formatCurrency(payment.amount)}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                                {payment.payment_method || 'Transferencia'}
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Factura: <span className="font-mono">{payment.invoice?.invoice_number}</span>
                                            {' • '}
                                            {payment.invoice?.contact?.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {new Date(payment.created_at).toLocaleString('es-PE')}
                                        </p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(payment.proof_url, '_blank')}
                                        title="Ver comprobante"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                    <Button
                                        variant="default"
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700"
                                        disabled={processing === payment.id}
                                        onClick={() => handleVerify(payment.id, true)}
                                    >
                                        {processing === payment.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <><CheckCircle className="w-4 h-4 mr-1" /> Aprobar</>
                                        )}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="text-red-600 hover:bg-red-50 border-red-200"
                                        disabled={processing === payment.id}
                                        onClick={() => handleVerify(payment.id, false)}
                                    >
                                        {processing === payment.id ? (
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <><XCircle className="w-4 h-4 mr-1" /> Rechazar</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Comprobante de Pago</DialogTitle>
                        <DialogDescription>
                            Verifica que el monto y datos coincidan con la factura
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex justify-center">
                        {previewImage && (
                            <img
                                src={previewImage}
                                alt="Comprobante de pago"
                                className="max-h-[70vh] rounded-lg border"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
