"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Loader2, CheckCircle, AlertCircle, Phone, QrCode, Landmark,
    Upload, FileText, Building, Calendar, CreditCard
} from "lucide-react"
import { toast } from "sonner"

interface PaymentData {
    type: 'quote' | 'invoice'
    document: any
    organization: any
    paymentMethods: {
        yape: { phone: string; qrUrl?: string } | null
        plin: { phone: string; qrUrl?: string } | null
        bank: { name: string; account: string; cci: string; holder: string } | null
    }
}

export default function PublicPaymentPage() {
    const params = useParams()
    const token = (params?.token as string) || ""

    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [data, setData] = useState<PaymentData | null>(null)
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [proofUrl, setProofUrl] = useState("")
    const [notes, setNotes] = useState("")

    useEffect(() => {
        if (token) {
            fetchData()
        }
    }, [token])

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/pay/${token}`)
            const result = await res.json()

            if (!res.ok) {
                throw new Error(result.error || "Error al cargar")
            }

            setData(result.data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!proofUrl) {
            toast.error("Por favor ingresa la URL del comprobante")
            return
        }

        setSubmitting(true)
        try {
            const res = await fetch(`/api/pay/${token}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proof_url: proofUrl, notes })
            })

            const result = await res.json()
            if (!res.ok) throw new Error(result.error)

            setSubmitted(true)
            toast.success("Comprobante enviado correctamente")
        } catch (err: any) {
            toast.error(err.message || "Error al enviar")
        } finally {
            setSubmitting(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-red-700 mb-2">Enlace no válido</h2>
                        <p className="text-muted-foreground">{error}</p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
                <Card className="max-w-md w-full">
                    <CardContent className="pt-6 text-center">
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-green-700 mb-2">¡Comprobante enviado!</h2>
                        <p className="text-muted-foreground">
                            Tu comprobante de pago ha sido recibido y será verificado pronto.
                            Recibirás una confirmación por correo.
                        </p>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const doc = data?.document
    const org = data?.organization
    const pm = data?.paymentMethods

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(amount)

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 p-4 md:p-8">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="text-center">
                    {org?.logo_url && (
                        <img src={org.logo_url} alt={org.name} className="h-16 mx-auto mb-4" />
                    )}
                    <h1 className="text-2xl font-bold text-gray-900">{org?.name}</h1>
                    <p className="text-muted-foreground">
                        {data?.type === 'quote' ? 'Cotización' : 'Factura'} #{doc?.quote_number || doc?.invoice_number}
                    </p>
                </div>

                {/* Document Details */}
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="w-5 h-5" />
                                    Detalle
                                </CardTitle>
                                <CardDescription>
                                    Cliente: {doc?.contact?.name || doc?.contact?.company}
                                </CardDescription>
                            </div>
                            <Badge variant={doc?.status === 'paid' ? 'default' : 'secondary'}>
                                {doc?.status}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-muted-foreground">Fecha:</span>
                                <p className="font-medium">
                                    {new Date(doc?.created_at || doc?.issue_date).toLocaleDateString('es-PE')}
                                </p>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Vence:</span>
                                <p className="font-medium">
                                    {new Date(doc?.valid_until || doc?.due_date).toLocaleDateString('es-PE')}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Items */}
                        <div className="space-y-2">
                            {doc?.items?.map((item: any, i: number) => (
                                <div key={i} className="flex justify-between text-sm">
                                    <span>{item.description} x{item.quantity}</span>
                                    <span className="font-medium">{formatCurrency(item.total)}</span>
                                </div>
                            ))}
                        </div>

                        <Separator />

                        <div className="flex justify-between text-lg font-bold">
                            <span>Total a Pagar:</span>
                            <span className="text-cyan-600">
                                {formatCurrency(doc?.total_amount || doc?.total || 0)}
                            </span>
                        </div>
                    </CardContent>
                </Card>

                {/* Payment Methods */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            Medios de Pago
                        </CardTitle>
                        <CardDescription>
                            Elige cómo quieres pagar
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Yape */}
                        {pm?.yape && (
                            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Phone className="w-5 h-5 text-purple-600" />
                                    <span className="font-semibold text-purple-700">Yape</span>
                                </div>
                                <p className="text-lg font-mono">{pm.yape.phone}</p>
                                {pm.yape.qrUrl && (
                                    <img src={pm.yape.qrUrl} alt="QR Yape" className="mt-2 w-32 h-32 rounded" />
                                )}
                            </div>
                        )}

                        {/* Plin */}
                        {pm?.plin && (
                            <div className="p-4 bg-cyan-50 rounded-lg border border-cyan-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <QrCode className="w-5 h-5 text-cyan-600" />
                                    <span className="font-semibold text-cyan-700">Plin</span>
                                </div>
                                <p className="text-lg font-mono">{pm.plin.phone}</p>
                                {pm.plin.qrUrl && (
                                    <img src={pm.plin.qrUrl} alt="QR Plin" className="mt-2 w-32 h-32 rounded" />
                                )}
                            </div>
                        )}

                        {/* Bank */}
                        {pm?.bank && (
                            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                    <Landmark className="w-5 h-5 text-green-600" />
                                    <span className="font-semibold text-green-700">Transferencia Bancaria</span>
                                </div>
                                <div className="grid gap-1 text-sm">
                                    <p><span className="text-muted-foreground">Banco:</span> <strong>{pm.bank.name}</strong></p>
                                    <p><span className="text-muted-foreground">Titular:</span> {pm.bank.holder}</p>
                                    <p><span className="text-muted-foreground">Cuenta:</span> <strong className="font-mono">{pm.bank.account}</strong></p>
                                    <p><span className="text-muted-foreground">CCI:</span> <span className="font-mono">{pm.bank.cci}</span></p>
                                </div>
                            </div>
                        )}

                        <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
                            <strong>Referencia:</strong> {doc?.quote_number || doc?.invoice_number} - {formatCurrency(doc?.total_amount || doc?.total || 0)}
                        </div>
                    </CardContent>
                </Card>

                {/* Upload Proof */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Upload className="w-5 h-5" />
                            Enviar Comprobante
                        </CardTitle>
                        <CardDescription>
                            Sube una captura o foto de tu comprobante de pago
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>URL del comprobante *</Label>
                            <Input
                                placeholder="https://ejemplo.com/captura.jpg"
                                value={proofUrl}
                                onChange={(e) => setProofUrl(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Sube tu imagen a un servicio como Imgur o Google Drive y pega el enlace aquí
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label>Notas (opcional)</Label>
                            <Textarea
                                placeholder="Información adicional sobre el pago..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                            />
                        </div>

                        <Button
                            className="w-full gradient-neon border-0"
                            onClick={handleSubmit}
                            disabled={submitting || !proofUrl}
                        >
                            {submitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                            ) : (
                                <><Upload className="w-4 h-4 mr-2" /> Enviar Comprobante</>
                            )}
                        </Button>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-xs text-muted-foreground">
                    Powered by CRM • {org?.email} • {org?.phone}
                </p>
            </div>
        </div>
    )
}
